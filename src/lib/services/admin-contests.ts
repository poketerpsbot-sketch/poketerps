import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import {
  auditLogs,
  badges,
  contestLinks,
  contestParticipations,
  contestWinnerHistory,
  contests,
  contestWinners,
  entries,
  userBadges,
  userNotifications,
} from "@/lib/db/schema";
import { conflict, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import { awardConfiguredExperience, ensureUserBadge } from "@/lib/services/experience";
import { slugify } from "@/lib/validation/common";
import type {
  adminContestParticipationsQuerySchema,
  adminContestsQuerySchema,
  createContestSchema,
  moderateContestParticipationSchema,
  publishContestResultSchema,
  selectContestWinnerSchema,
  updateContestSchema,
} from "@/lib/validation/contests";

type AdminContestsQuery = z.infer<typeof adminContestsQuerySchema>;
type AdminParticipationsQuery = z.infer<typeof adminContestParticipationsQuerySchema>;
type ContestInput = z.infer<typeof createContestSchema>;
type ContestUpdate = z.infer<typeof updateContestSchema>;
type ModerationInput = z.infer<typeof moderateContestParticipationSchema>;
type WinnerInput = z.infer<typeof selectContestWinnerSchema>;
type PublishResultInput = z.infer<typeof publishContestResultSchema>;

const contestSelection = {
  id: contests.id,
  slug: contests.slug,
  title: contests.title,
  summary: contests.summary,
  description: contests.description,
  rules: contests.rules,
  imageUrl: contests.imageUrl,
  status: contests.status,
  isFeatured: contests.isFeatured,
  startsAt: contests.startsAt,
  endsAt: contests.endsAt,
  scoringMode: contests.scoringMode,
  criteria: contests.criteria,
  reward: contests.reward,
  rewardBadgeId: contests.rewardBadgeId,
  maxParticipants: contests.maxParticipants,
  requireEntry: contests.requireEntry,
  contestType: contests.contestType,
  instructions: contests.instructions,
  participationSteps: contests.participationSteps,
  externalUrl: contests.externalUrl,
  telegramUrl: contests.telegramUrl,
  instagramUrl: contests.instagramUrl,
  terms: contests.terms,
  additionalInformation: contests.additionalInformation,
  registrationsOpen: contests.registrationsOpen,
  registrationStartsAt: contests.registrationStartsAt,
  registrationEndsAt: contests.registrationEndsAt,
  registrationsClosedAt: contests.registrationsClosedAt,
  shortDescription: contests.shortDescription,
  publicIntro: contests.publicIntro,
  participantInstructions: contests.participantInstructions,
  shortRules: contests.shortRules,
  fullRules: contests.fullRules,
  longDescription: contests.longDescription,
  mainImageUrl: contests.mainImageUrl,
  resultImageUrl: contests.resultImageUrl,
  mainImageBucket: contests.mainImageBucket,
  mainImagePath: contests.mainImagePath,
  resultImageBucket: contests.resultImageBucket,
  resultImagePath: contests.resultImagePath,
  resultText: contests.resultText,
  registrationsManuallyClosed: contests.registrationsManuallyClosed,
  resultPublicationMode: contests.resultPublicationMode,
  resultPublishedAt: contests.resultPublishedAt,
  publishedAt: contests.publishedAt,
  secretWeight: contests.secretWeight,
  weightUnit: contests.weightUnit,
  customWeightUnit: contests.customWeightUnit,
  allowGuessEditing: contests.allowGuessEditing,
  tieBreakerMode: contests.tieBreakerMode,
  notifyTelegramOnPublish: contests.notifyTelegramOnPublish,
  notifyParticipantsOnResult: contests.notifyParticipantsOnResult,
  createdById: contests.createdById,
  updatedById: contests.updatedById,
  createdAt: contests.createdAt,
  updatedAt: contests.updatedAt,
  deletedAt: contests.deletedAt,
};

const participationSelection = {
  id: contestParticipations.id,
  contestId: contestParticipations.contestId,
  userId: contestParticipations.userId,
  entryId: contestParticipations.entryId,
  status: contestParticipations.status,
  statement: contestParticipations.statement,
  manualScore: contestParticipations.manualScore,
  scoreBreakdown: contestParticipations.scoreBreakdown,
  moderatedById: contestParticipations.moderatedById,
  moderatedAt: contestParticipations.moderatedAt,
  moderationNote: contestParticipations.moderationNote,
  submittedAt: contestParticipations.submittedAt,
  updatedAt: contestParticipations.updatedAt,
  withdrawnAt: contestParticipations.withdrawnAt,
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function contestMutation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Ce slug, ce rang ou cette participation existe déjà.", "CONTEST_CONFLICT");
    }
    throw error;
  }
}

async function assertRewardBadge(badgeId?: string | null) {
  if (!badgeId) return;
  const [badge] = await getDb()
    .select({ id: badges.id })
    .from(badges)
    .where(and(eq(badges.id, badgeId), eq(badges.isActive, true)))
    .limit(1);
  if (!badge) throw notFound("Badge de récompense");
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function replaceContestLinks(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  contestId: string,
  links: ContestInput["links"] | ContestUpdate["links"],
) {
  await tx.delete(contestLinks).where(eq(contestLinks.contestId, contestId));
  if (!links?.length) return;
  await tx.insert(contestLinks).values(
    links.map((link, index) => ({
      contestId,
      label: link.label,
      url: link.url,
      type: link.type,
      visibility: link.visibility,
      displayOrder: link.displayOrder ?? index,
    })),
  );
}

export async function listAdminContests(query: AdminContestsQuery) {
  const sqlClient = getSqlClient();
  const [envelope] = await sqlClient.unsafe<
    { items: Record<string, unknown>[] | null; total: number | string }[]
  >(
    `with enriched as (
      select c.*,
        (select count(*)::int from contest_participations p
          where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) participation_count,
        (select count(*)::int from contest_participations p
          where p.contest_id=c.id and p.status='PENDING_REVIEW') pending_count,
        public.contest_effective_status(c.id,now()) effective_status
      from contests c
      where c.deleted_at is null
    ), filtered as (
      select * from enriched c where
        ($1::contest_status is null or c.status=$1::contest_status)
        and ($2::text is null or c.title ilike '%' || $2 || '%' or c.slug ilike '%' || $2 || '%')
        and ($3::text='all'
          or ($3='draft' and c.effective_status='DRAFT')
          or ($3='upcoming' and c.effective_status='UPCOMING')
          or ($3='active' and c.effective_status in ('OPEN','FULL','CLOSED'))
          or ($3='ended' and c.effective_status in ('ENDED','ENDED_PENDING_RESULT')))
    ), page as (
      select * from filtered order by is_featured desc,starts_at desc limit $4 offset $5
    )
    select coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb) items,
      (select count(*)::int from filtered) total`,
    [query.status ?? null, query.query ?? null, query.phase, query.limit, query.offset],
  );
  return { contests: envelope?.items ?? [], total: Number(envelope?.total ?? 0) };
}

export async function getAdminContest(id: string) {
  const [contest] = await getDb()
    .select(contestSelection)
    .from(contests)
    .where(and(eq(contests.id, id), isNull(contests.deletedAt)))
    .limit(1);
  if (!contest) throw notFound("Concours");
  const [[counts], winners, links, analytics, guessRanking, winnerHistory] = await Promise.all([
    getDb()
      .select({
        total: sql<number>`count(*) filter (where ${contestParticipations.status} in ('PENDING_REVIEW','APPROVED'))::int`,
        pending: sql<number>`count(*) filter (where ${contestParticipations.status}='PENDING_REVIEW')::int`,
        approved: sql<number>`count(*) filter (where ${contestParticipations.status}='APPROVED')::int`,
      })
      .from(contestParticipations)
      .where(eq(contestParticipations.contestId, id)),
    getDb()
      .select()
      .from(contestWinners)
      .where(eq(contestWinners.contestId, id))
      .orderBy(contestWinners.rank),
    getDb()
      .select()
      .from(contestLinks)
      .where(eq(contestLinks.contestId, id))
      .orderBy(contestLinks.displayOrder),
    getSqlClient()<
      Array<{
        page_views: number;
        join_clicks: number;
        link_clicks: number;
        telegram_sent: number;
        telegram_failed: number;
        mini_app_notifications: number;
        guess_count: number;
        modified_guess_count: number;
        average_guess: number | null;
        minimum_guess: number | null;
        maximum_guess: number | null;
      }>
    >`
      select
        (select count(*)::int from contest_view_events where contest_id=${id}::uuid and event_type='PAGE_VIEW') page_views,
        (select count(*)::int from contest_view_events where contest_id=${id}::uuid and event_type='JOIN_CLICK') join_clicks,
        (select count(*)::int from contest_view_events where contest_id=${id}::uuid and event_type='LINK_CLICK') link_clicks,
        coalesce((select sum(sent_count)::int from telegram_broadcasts where contest_id=${id}::uuid),0) telegram_sent,
        coalesce((select sum(failed_count)::int from telegram_broadcasts where contest_id=${id}::uuid),0) telegram_failed,
        (select count(*)::int from user_notifications where related_contest_id=${id}::uuid) mini_app_notifications,
        (select count(*)::int from contest_guesses where contest_id=${id}::uuid) guess_count,
        (select count(*)::int from contest_guesses where contest_id=${id}::uuid and submission_count>1) modified_guess_count,
        (select avg(numeric_value)::float8 from contest_guesses where contest_id=${id}::uuid) average_guess,
        (select min(numeric_value)::float8 from contest_guesses where contest_id=${id}::uuid) minimum_guess,
        (select max(numeric_value)::float8 from contest_guesses where contest_id=${id}::uuid) maximum_guess
    `,
    getSqlClient()<Array<Record<string, unknown>>>`
      select g.id,g.user_id,g.numeric_value::float8 numeric_value,g.unit,g.submitted_at,g.updated_at,
        abs(g.numeric_value-c.secret_weight)::float8 difference,
        u.display_name,u.telegram_username,u.profile_photo_url,p.id participation_id,
        dense_rank() over(order by abs(g.numeric_value-c.secret_weight),g.submitted_at)::int calculated_rank
      from contest_guesses g join contests c on c.id=g.contest_id
      join users u on u.id=g.user_id join contest_participations p on p.id=g.participation_id
      where g.contest_id=${id}::uuid and c.secret_weight is not null
      order by calculated_rank,g.submitted_at limit 100
    `,
    getDb()
      .select()
      .from(contestWinnerHistory)
      .where(eq(contestWinnerHistory.contestId, id))
      .orderBy(sql`${contestWinnerHistory.createdAt} desc`),
  ]);
  return {
    ...contest,
    participantCount: Number(counts?.total ?? 0),
    pendingCount: Number(counts?.pending ?? 0),
    approvedCount: Number(counts?.approved ?? 0),
    winners,
    links,
    analytics: analytics[0] ?? null,
    guessRanking,
    winnerHistory,
  };
}

export async function createContest(input: ContestInput, actor: CurrentUser, requestId?: string) {
  await assertRewardBadge(input.rewardBadgeId);
  return contestMutation(() =>
    getDb().transaction(async (tx) => {
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      const registrationStartsAt = new Date(input.registrationStartsAt ?? input.startsAt);
      const registrationEndsAt = new Date(input.registrationEndsAt ?? input.endsAt);
      const status = input.status;
      const publishedAt = status === "DRAFT" ? null : new Date();
      const [created] = await tx
        .insert(contests)
        .values({
          slug: input.slug ?? `${slugify(input.title)}-${Date.now().toString(36)}`,
          title: input.title,
          summary: optionalText(input.shortDescription ?? input.summary),
          description: optionalText(input.longDescription ?? input.description),
          rules: optionalText(input.fullRules ?? input.rules),
          imageUrl: input.mainImageUrl ?? input.imageUrl ?? null,
          status,
          contestType: input.contestType,
          instructions: optionalText(input.participantInstructions ?? input.instructions) ?? "",
          participationSteps: input.participationSteps,
          externalUrl: input.externalUrl ?? null,
          telegramUrl: input.telegramUrl ?? null,
          instagramUrl: input.instagramUrl ?? null,
          terms: optionalText(input.terms),
          additionalInformation: optionalText(input.additionalInformation),
          registrationsOpen: input.registrationsOpen,
          registrationsManuallyClosed: input.registrationsManuallyClosed,
          shortDescription: optionalText(input.shortDescription ?? input.summary),
          publicIntro: optionalText(input.publicIntro),
          participantInstructions: optionalText(
            input.participantInstructions ?? input.instructions,
          ),
          shortRules: optionalText(input.shortRules),
          fullRules: optionalText(input.fullRules ?? input.rules),
          longDescription: optionalText(input.longDescription ?? input.description),
          mainImageUrl: input.mainImageUrl ?? input.imageUrl ?? null,
          mainImageBucket: input.mainImageBucket ?? null,
          mainImagePath: input.mainImagePath ?? null,
          resultImageUrl: input.resultImageUrl ?? null,
          resultImageBucket: input.resultImageBucket ?? null,
          resultImagePath: input.resultImagePath ?? null,
          resultText: optionalText(input.resultText),
          resultPublicationMode: input.resultPublicationMode,
          resultPublishedAt: input.resultPublishedAt ? new Date(input.resultPublishedAt) : null,
          publishedAt,
          secretWeight: input.secretWeight == null ? null : String(input.secretWeight),
          weightUnit: input.weightUnit ?? null,
          customWeightUnit: optionalText(input.customWeightUnit),
          allowGuessEditing: input.allowGuessEditing,
          tieBreakerMode: input.tieBreakerMode,
          notifyTelegramOnPublish: input.notifyTelegramOnPublish,
          notifyParticipantsOnResult: input.notifyParticipantsOnResult,
          isFeatured: input.isFeatured,
          startsAt,
          endsAt,
          scoringMode: input.scoringMode,
          criteria: input.criteria,
          reward: input.reward,
          rewardBadgeId: input.rewardBadgeId ?? null,
          maxParticipants: input.maxParticipants ?? null,
          requireEntry: input.requireEntry,
          registrationStartsAt,
          registrationEndsAt,
          registrationsClosedAt: input.registrationsOpen ? null : new Date(),
          createdById: actor.id,
          updatedById: actor.id,
        })
        .returning(contestSelection);
      if (!created) throw new Error("Contest insert failed");
      await replaceContestLinks(tx, created.id, input.links);
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "CONTEST_CREATED",
          entityType: "CONTEST",
          entityId: created.id,
          source: "WEB_ADMIN",
          requestId,
          after: created,
        }),
      );
      return { ...created, links: input.links };
    }),
  );
}

export async function updateContest(
  id: string,
  input: ContestUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  await assertRewardBadge(input.rewardBadgeId);
  return contestMutation(() =>
    getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select(contestSelection)
        .from(contests)
        .where(and(eq(contests.id, id), isNull(contests.deletedAt)))
        .limit(1)
        .for("update");
      if (!existing) throw notFound("Concours");
      const startsAtInput = input.startsAt;
      const endsAtInput = input.endsAt;
      const registrationStartsAtInput = input.registrationStartsAt;
      const registrationEndsAtInput = input.registrationEndsAt;
      const startsAt = startsAtInput ? new Date(startsAtInput) : existing.startsAt;
      const endsAt = endsAtInput ? new Date(endsAtInput) : existing.endsAt;
      if (endsAt <= startsAt) {
        throw conflict("La fin du concours doit suivre son début.", "CONTEST_DATES_INVALID");
      }
      const updates: Partial<typeof contests.$inferInsert> = {
        updatedById: actor.id,
        updatedAt: new Date(),
      };
      const set = <K extends keyof typeof updates>(key: K, value: (typeof updates)[K]) => {
        updates[key] = value;
      };
      if (input.slug !== undefined) set("slug", input.slug);
      if (input.title !== undefined) set("title", input.title);
      if (input.shortDescription !== undefined || input.summary !== undefined) {
        const value = optionalText(input.shortDescription ?? input.summary);
        set("shortDescription", value);
        set("summary", value);
      }
      if (input.longDescription !== undefined || input.description !== undefined) {
        const value = optionalText(input.longDescription ?? input.description);
        set("longDescription", value);
        set("description", value);
      }
      if (input.fullRules !== undefined || input.rules !== undefined) {
        const value = optionalText(input.fullRules ?? input.rules);
        set("fullRules", value);
        set("rules", value);
      }
      if (input.imageUrl !== undefined || input.mainImageUrl !== undefined) {
        const value = input.mainImageUrl ?? input.imageUrl ?? null;
        set("mainImageUrl", value);
        set("imageUrl", value);
      }
      if (input.status !== undefined) {
        set("status", input.status);
        if (input.status !== "DRAFT" && !existing.publishedAt) set("publishedAt", new Date());
      }
      if (input.isFeatured !== undefined) set("isFeatured", input.isFeatured);
      if (input.scoringMode !== undefined) set("scoringMode", input.scoringMode);
      if (input.criteria !== undefined) set("criteria", input.criteria);
      if (input.reward !== undefined) set("reward", input.reward);
      if (input.rewardBadgeId !== undefined) set("rewardBadgeId", input.rewardBadgeId);
      if (input.maxParticipants !== undefined) set("maxParticipants", input.maxParticipants);
      if (input.requireEntry !== undefined) set("requireEntry", input.requireEntry);
      if (input.contestType !== undefined) set("contestType", input.contestType);
      if (input.instructions !== undefined || input.participantInstructions !== undefined) {
        const value = optionalText(input.participantInstructions ?? input.instructions);
        set("participantInstructions", value);
        set("instructions", value ?? "");
      }
      if (input.participationSteps !== undefined)
        set("participationSteps", input.participationSteps);
      if (input.externalUrl !== undefined) set("externalUrl", input.externalUrl);
      if (input.telegramUrl !== undefined) set("telegramUrl", input.telegramUrl);
      if (input.instagramUrl !== undefined) set("instagramUrl", input.instagramUrl);
      if (input.terms !== undefined) set("terms", optionalText(input.terms));
      if (input.additionalInformation !== undefined) {
        set("additionalInformation", optionalText(input.additionalInformation));
      }
      if (input.publicIntro !== undefined) set("publicIntro", optionalText(input.publicIntro));
      if (input.shortRules !== undefined) set("shortRules", optionalText(input.shortRules));
      if (input.resultImageUrl !== undefined) set("resultImageUrl", input.resultImageUrl);
      if (input.mainImageBucket !== undefined) set("mainImageBucket", input.mainImageBucket);
      if (input.mainImagePath !== undefined)
        set("mainImagePath", optionalText(input.mainImagePath));
      if (input.resultImageBucket !== undefined) set("resultImageBucket", input.resultImageBucket);
      if (input.resultImagePath !== undefined)
        set("resultImagePath", optionalText(input.resultImagePath));
      if (input.resultText !== undefined) set("resultText", optionalText(input.resultText));
      if (input.registrationsOpen !== undefined) {
        set("registrationsOpen", input.registrationsOpen);
        set("registrationsClosedAt", input.registrationsOpen ? null : new Date());
      }
      if (input.registrationsManuallyClosed !== undefined) {
        set("registrationsManuallyClosed", input.registrationsManuallyClosed);
      }
      if (input.resultPublicationMode !== undefined) {
        set("resultPublicationMode", input.resultPublicationMode);
      }
      if (input.resultPublishedAt !== undefined) {
        set(
          "resultPublishedAt",
          input.resultPublishedAt ? new Date(input.resultPublishedAt) : null,
        );
      }
      if (input.secretWeight !== undefined) {
        set("secretWeight", input.secretWeight == null ? null : String(input.secretWeight));
      }
      if (input.weightUnit !== undefined) set("weightUnit", input.weightUnit);
      if (input.customWeightUnit !== undefined)
        set("customWeightUnit", optionalText(input.customWeightUnit));
      if (input.allowGuessEditing !== undefined) set("allowGuessEditing", input.allowGuessEditing);
      if (input.tieBreakerMode !== undefined) set("tieBreakerMode", input.tieBreakerMode);
      if (input.notifyTelegramOnPublish !== undefined) {
        set("notifyTelegramOnPublish", input.notifyTelegramOnPublish);
      }
      if (input.notifyParticipantsOnResult !== undefined) {
        set("notifyParticipantsOnResult", input.notifyParticipantsOnResult);
      }
      if (startsAtInput !== undefined) {
        set("startsAt", startsAt);
        set(
          "registrationStartsAt",
          registrationStartsAtInput ? new Date(registrationStartsAtInput) : startsAt,
        );
      } else if (registrationStartsAtInput !== undefined) {
        set(
          "registrationStartsAt",
          registrationStartsAtInput ? new Date(registrationStartsAtInput) : existing.startsAt,
        );
      }
      if (endsAtInput !== undefined) {
        set("endsAt", endsAt);
        set(
          "registrationEndsAt",
          registrationEndsAtInput ? new Date(registrationEndsAtInput) : endsAt,
        );
      } else if (registrationEndsAtInput !== undefined) {
        set(
          "registrationEndsAt",
          registrationEndsAtInput ? new Date(registrationEndsAtInput) : existing.endsAt,
        );
      }

      const [updated] = await tx
        .update(contests)
        .set(updates)
        .where(eq(contests.id, id))
        .returning(contestSelection);
      if (!updated) throw new Error("Contest update failed");
      if (input.links !== undefined) await replaceContestLinks(tx, id, input.links);
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "CONTEST_UPDATED",
          entityType: "CONTEST",
          entityId: id,
          source: "WEB_ADMIN",
          requestId,
          before: existing,
          after: updated,
        }),
      );
      return updated;
    }),
  );
}

export async function deleteContest(id: string, actor: CurrentUser, requestId?: string) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select(contestSelection)
      .from(contests)
      .where(and(eq(contests.id, id), isNull(contests.deletedAt)))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Concours");
    const now = new Date();
    const [deleted] = await tx
      .update(contests)
      .set({ status: "CANCELLED", deletedAt: now, updatedById: actor.id, updatedAt: now })
      .where(eq(contests.id, id))
      .returning(contestSelection);
    if (!deleted) throw new Error("Contest delete failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "CONTEST_DELETED",
        entityType: "CONTEST",
        entityId: id,
        source: "WEB_ADMIN",
        requestId,
        before: existing,
        after: deleted,
      }),
    );
    return { id, deleted: true };
  });
}

export async function listAdminContestParticipations(
  contestId: string,
  query: AdminParticipationsQuery,
) {
  const sqlClient = getSqlClient();
  const contest = await getAdminContest(contestId);
  const [envelope] = await sqlClient.unsafe<
    { items: Record<string, unknown>[] | null; total: number | string }[]
  >(
    `with filtered as (
      select p.*,u.display_name,u.public_slug,u.telegram_username,u.profile_photo_url,u.role,u.is_banned,
        e.slug entry_slug,e.name entry_name,e.status entry_status,
        w.id winner_id,w.rank winner_rank,w.label winner_label,
        g.numeric_value::float8 guess_value,g.unit guess_unit,g.submitted_at guess_submitted_at,
        g.updated_at guess_updated_at,g.submission_count,
        case when c.secret_weight is not null then abs(g.numeric_value-c.secret_weight)::float8 end guess_difference
      from contest_participations p
      join contests c on c.id=p.contest_id
      join users u on u.id=p.user_id
      left join entries e on e.id=p.entry_id
      left join contest_winners w on w.participation_id=p.id and w.contest_id=p.contest_id
      left join contest_guesses g on g.participation_id=p.id and g.contest_id=p.contest_id
      where p.contest_id=$1::uuid
        and ($2::contest_participation_status is null or p.status=$2::contest_participation_status)
        and ($3::text is null or u.display_name ilike '%' || $3 || '%'
          or coalesce(u.telegram_username,'') ilike '%' || $3 || '%'
          or coalesce(e.name,'') ilike '%' || $3 || '%')
    ), page as (
      select * from filtered order by
        case when $4='name' then display_name end asc,
        case when $4='oldest' then submitted_at end asc,
        case when $4='newest' then submitted_at end desc,
        id limit $5 offset $6
    )
    select coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb) items,
      (select count(*)::int from filtered) total`,
    [contest.id, query.status ?? null, query.query ?? null, query.sort, query.limit, query.offset],
  );
  return { participations: envelope?.items ?? [], total: Number(envelope?.total ?? 0) };
}

export async function moderateContestParticipation(
  contestId: string,
  participationId: string,
  input: ModerationInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select(participationSelection)
      .from(contestParticipations)
      .where(
        and(
          eq(contestParticipations.id, participationId),
          eq(contestParticipations.contestId, contestId),
        ),
      )
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Participation");
    const [contest] = await tx
      .select({ requireEntry: contests.requireEntry })
      .from(contests)
      .where(and(eq(contests.id, contestId), isNull(contests.deletedAt)))
      .limit(1);
    if (!contest) throw notFound("Concours");
    if (input.status === "APPROVED" && contest.requireEntry) {
      if (!existing.entryId) {
        throw conflict("Une fiche publiée est requise pour approuver cette participation.");
      }
      const [entry] = await tx
        .select({ id: entries.id })
        .from(entries)
        .where(
          and(
            eq(entries.id, existing.entryId),
            eq(entries.originalContributorId, existing.userId),
            eq(entries.status, "PUBLISHED"),
            eq(entries.isDemo, false),
            isNull(entries.deletedAt),
          ),
        )
        .limit(1);
      if (!entry) {
        throw conflict(
          "La fiche liée n’est plus une capture publiée admissible.",
          "CONTEST_ENTRY_INELIGIBLE",
        );
      }
    }
    if (input.status && input.status !== "APPROVED") {
      const [winner] = await tx
        .select({ id: contestWinners.id })
        .from(contestWinners)
        .where(eq(contestWinners.participationId, participationId))
        .limit(1);
      if (winner) {
        throw conflict(
          "Retirez d’abord cette participation des gagnants.",
          "CONTEST_WINNER_LOCKED",
        );
      }
    }
    const now = new Date();
    const [updated] = await tx
      .update(contestParticipations)
      .set({
        ...(input.status ? { status: input.status } : {}),
        ...(input.status ? { withdrawnAt: null } : {}),
        ...(input.moderationNote !== undefined ? { moderationNote: input.moderationNote } : {}),
        ...(input.manualScore !== undefined ? { manualScore: String(input.manualScore) } : {}),
        ...(input.scoreBreakdown !== undefined ? { scoreBreakdown: input.scoreBreakdown } : {}),
        moderatedById: actor.id,
        moderatedAt: now,
        updatedAt: now,
      })
      .where(eq(contestParticipations.id, participationId))
      .returning(participationSelection);
    if (!updated) throw new Error("Contest participation update failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "CONTEST_PARTICIPATION_MODERATED",
        entityType: "CONTEST_PARTICIPATION",
        entityId: participationId,
        source: "WEB_ADMIN",
        requestId,
        before: existing,
        after: updated,
        metadata: { contestId },
      }),
    );
    return updated;
  });
}

export async function selectContestWinner(
  contestId: string,
  input: WinnerInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return contestMutation(() =>
    getDb().transaction(async (tx) => {
      const [contest] = await tx
        .select({
          id: contests.id,
          slug: contests.slug,
          title: contests.title,
          status: contests.status,
          endsAt: contests.endsAt,
          registrationEndsAt: contests.registrationEndsAt,
        })
        .from(contests)
        .where(and(eq(contests.id, contestId), isNull(contests.deletedAt)))
        .limit(1)
        .for("update");
      if (!contest) throw notFound("Concours");
      if (
        contest.status === "DRAFT" ||
        contest.status === "CANCELLED" ||
        (contest.status !== "ENDED" && (contest.registrationEndsAt ?? contest.endsAt) > new Date())
      ) {
        throw conflict(
          "Les gagnants se choisissent après la fin du concours.",
          "CONTEST_NOT_ENDED",
        );
      }
      const [participation] = await tx
        .select({
          id: contestParticipations.id,
          status: contestParticipations.status,
          userId: contestParticipations.userId,
        })
        .from(contestParticipations)
        .where(
          and(
            eq(contestParticipations.id, input.participationId),
            eq(contestParticipations.contestId, contestId),
          ),
        )
        .limit(1);
      if (!participation || participation.status !== "APPROVED") {
        throw conflict(
          "Seule une participation approuvée peut gagner.",
          "CONTEST_WINNER_INELIGIBLE",
        );
      }
      const [previousWinner] = await tx
        .select({
          id: contestWinners.id,
          userId: contestParticipations.userId,
          participationId: contestWinners.participationId,
        })
        .from(contestWinners)
        .innerJoin(
          contestParticipations,
          eq(contestParticipations.id, contestWinners.participationId),
        )
        .where(and(eq(contestWinners.contestId, contestId), eq(contestWinners.rank, input.rank)))
        .limit(1)
        .for("update");
      if (previousWinner && !input.replaceExisting) {
        throw conflict("Ce concours possède déjà un gagnant.", "CONTEST_WINNER_EXISTS");
      }
      if (previousWinner) {
        await tx.delete(contestWinners).where(eq(contestWinners.id, previousWinner.id));
      }
      const [winner] = await tx
        .insert(contestWinners)
        .values({
          contestId,
          participationId: input.participationId,
          rank: input.rank,
          label: input.label ?? null,
          prize: input.prize,
          selectedById: actor.id,
        })
        .returning();
      if (!winner) throw new Error("Contest winner insert failed");
      await tx.insert(contestWinnerHistory).values({
        contestId,
        action: previousWinner ? "REPLACED" : "SELECTED",
        previousWinnerUserId: previousWinner?.userId ?? null,
        winnerUserId: participation.userId,
        selectedById: actor.id,
        selectedByRole: actor.role,
        reason: input.reason ?? null,
        metadata: { rank: input.rank, winnerId: winner.id },
      });
      await tx.insert(userNotifications).values({
        userId: participation.userId,
        type: "CONTEST_WINNER",
        title: "🏆 Tu as gagné !",
        message: `Félicitations, tu as gagné le concours « ${contest.title} ».`,
        relatedContestId: contestId,
        actionUrl: `/concours/${contest.slug}`,
        metadata: { winnerId: winner.id },
      });
      await awardConfiguredExperience(tx, {
        userId: participation.userId,
        ruleKey: "CONTEST_WIN",
        idempotencyKey: `CONTEST_WIN:${contestId}:${participation.userId}`,
        reason: `Victoire au concours « ${contest.title} »`,
        sourceType: "CONTEST",
        sourceId: contestId,
        metadata: { winnerId: winner.id, rank: input.rank },
      });
      await ensureUserBadge(tx, {
        userId: participation.userId,
        slug: "contest-winner",
        sourceType: "CONTEST",
        sourceId: contestId,
      });
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "CONTEST_WINNER_SELECTED",
          entityType: "CONTEST_WINNER",
          entityId: winner.id,
          source: "WEB_ADMIN",
          requestId,
          after: winner,
          metadata: {
            contestId,
            participationId: input.participationId,
            previousWinnerUserId: previousWinner?.userId ?? null,
            reason: input.reason ?? null,
          },
        }),
      );
      return winner;
    }),
  );
}

export async function removeContestWinner(
  contestId: string,
  winnerId: string,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: contestWinners.id,
        contestId: contestWinners.contestId,
        participationId: contestWinners.participationId,
        rank: contestWinners.rank,
        label: contestWinners.label,
        prize: contestWinners.prize,
        selectedById: contestWinners.selectedById,
        awardedAt: contestWinners.awardedAt,
        rewardBadgeId: contests.rewardBadgeId,
        winnerUserId: contestParticipations.userId,
      })
      .from(contestWinners)
      .innerJoin(
        contestParticipations,
        eq(contestParticipations.id, contestWinners.participationId),
      )
      .innerJoin(contests, eq(contests.id, contestWinners.contestId))
      .where(and(eq(contestWinners.id, winnerId), eq(contestWinners.contestId, contestId)))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Gagnant");
    await tx.delete(contestWinners).where(eq(contestWinners.id, winnerId));
    await tx.insert(contestWinnerHistory).values({
      contestId,
      action: "REMOVED",
      previousWinnerUserId: existing.winnerUserId,
      winnerUserId: null,
      selectedById: actor.id,
      selectedByRole: actor.role,
      reason: "Retrait confirmé depuis l’administration",
      metadata: { winnerId, rank: existing.rank },
    });
    if (existing.rewardBadgeId) {
      await tx
        .update(userBadges)
        .set({
          isActive: false,
          revokedAt: new Date(),
          revokeReason: "Palmarès du concours corrigé",
        })
        .where(
          and(
            eq(userBadges.userId, existing.winnerUserId),
            eq(userBadges.badgeId, existing.rewardBadgeId),
            eq(userBadges.isActive, true),
            sql`${userBadges.metadata}->>'winnerId'=${winnerId}`,
          ),
        );
    }
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "CONTEST_WINNER_REMOVED",
        entityType: "CONTEST_WINNER",
        entityId: winnerId,
        source: "WEB_ADMIN",
        requestId,
        before: existing,
        metadata: { contestId },
      }),
    );
    return { id: winnerId, removed: true };
  });
}

export async function publishContestResult(
  contestId: string,
  input: PublishResultInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select(contestSelection)
      .from(contests)
      .where(and(eq(contests.id, contestId), isNull(contests.deletedAt)))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Concours");
    if (new Date(existing.endsAt) > new Date()) {
      throw conflict(
        "Le résultat ne peut être publié qu’après la fin du concours.",
        "CONTEST_NOT_ENDED",
      );
    }
    if (
      !existing.resultText &&
      existing.secretWeight === null &&
      !existing.resultImagePath &&
      !existing.resultImageUrl
    ) {
      throw conflict(
        "Ajoute un résultat, un poids réel ou une photo avant de publier.",
        "CONTEST_RESULT_EMPTY",
      );
    }
    const now = new Date();
    const [updated] = await tx
      .update(contests)
      .set({ resultPublishedAt: now, status: "ENDED", updatedAt: now, updatedById: actor.id })
      .where(eq(contests.id, contestId))
      .returning(contestSelection);
    if (!updated) throw new Error("Contest result publication failed");
    if (input.notifyParticipants || existing.notifyParticipantsOnResult) {
      const recipients = await tx
        .selectDistinct({ userId: contestParticipations.userId })
        .from(contestParticipations)
        .where(
          and(
            eq(contestParticipations.contestId, contestId),
            sql`${contestParticipations.status} in ('PENDING_REVIEW','APPROVED')`,
          ),
        );
      if (recipients.length > 0) {
        await tx.insert(userNotifications).values(
          recipients.map(({ userId }) => ({
            userId,
            type: "CONTEST_RESULT" as const,
            title: "Résultat du concours",
            message: `Le résultat de « ${existing.title} » est disponible.`,
            relatedContestId: contestId,
            actionUrl: `/concours/${existing.slug}`,
          })),
        );
      }
    }
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "CONTEST_RESULT_PUBLISHED",
        entityType: "CONTEST",
        entityId: contestId,
        source: "WEB_ADMIN",
        requestId,
        before: existing,
        after: updated,
      }),
    );
    return updated;
  });
}
