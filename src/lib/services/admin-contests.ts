import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import {
  auditLogs,
  badges,
  contestParticipations,
  contests,
  contestWinners,
  entries,
  userBadges,
} from "@/lib/db/schema";
import { conflict, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import type {
  adminContestParticipationsQuerySchema,
  adminContestsQuerySchema,
  createContestSchema,
  moderateContestParticipationSchema,
  selectContestWinnerSchema,
  updateContestSchema,
} from "@/lib/validation/contests";

type AdminContestsQuery = z.infer<typeof adminContestsQuerySchema>;
type AdminParticipationsQuery = z.infer<typeof adminContestParticipationsQuerySchema>;
type ContestInput = z.infer<typeof createContestSchema>;
type ContestUpdate = z.infer<typeof updateContestSchema>;
type ModerationInput = z.infer<typeof moderateContestParticipationSchema>;
type WinnerInput = z.infer<typeof selectContestWinnerSchema>;

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

export async function listAdminContests(query: AdminContestsQuery) {
  const sqlClient = getSqlClient();
  const [envelope] = await sqlClient.unsafe<
    { items: Record<string, unknown>[] | null; total: number | string }[]
  >(
    `with filtered as (
      select c.*,
        (select count(*)::int from contest_participations p
          where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) participation_count,
        (select count(*)::int from contest_participations p
          where p.contest_id=c.id and p.status='PENDING_REVIEW') pending_count
      from contests c
      where c.deleted_at is null
        and ($1::contest_status is null or c.status=$1::contest_status)
        and ($2::text is null or c.title ilike '%' || $2 || '%' or c.slug ilike '%' || $2 || '%')
    ), page as (
      select * from filtered order by is_featured desc,starts_at desc limit $3 offset $4
    )
    select coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb) items,
      (select count(*)::int from filtered) total`,
    [query.status ?? null, query.query ?? null, query.limit, query.offset],
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
  const [[counts], winners] = await Promise.all([
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
  ]);
  return {
    ...contest,
    participantCount: Number(counts?.total ?? 0),
    pendingCount: Number(counts?.pending ?? 0),
    approvedCount: Number(counts?.approved ?? 0),
    winners,
  };
}

export async function createContest(input: ContestInput, actor: CurrentUser, requestId?: string) {
  await assertRewardBadge(input.rewardBadgeId);
  return contestMutation(() =>
    getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(contests)
        .values({
          ...input,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          registrationStartsAt: input.registrationStartsAt
            ? new Date(input.registrationStartsAt)
            : null,
          registrationEndsAt: input.registrationEndsAt ? new Date(input.registrationEndsAt) : null,
          registrationsClosedAt: input.registrationsOpen ? null : new Date(),
          createdById: actor.id,
          updatedById: actor.id,
        })
        .returning(contestSelection);
      if (!created) throw new Error("Contest insert failed");
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
      return created;
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
      const {
        startsAt: startsAtInput,
        endsAt: endsAtInput,
        registrationStartsAt: registrationStartsAtInput,
        registrationEndsAt: registrationEndsAtInput,
        ...otherInput
      } = input;
      const startsAt = startsAtInput ? new Date(startsAtInput) : existing.startsAt;
      const endsAt = endsAtInput ? new Date(endsAtInput) : existing.endsAt;
      if (endsAt <= startsAt) {
        throw conflict("La fin du concours doit suivre son début.", "CONTEST_DATES_INVALID");
      }
      const [updated] = await tx
        .update(contests)
        .set({
          ...otherInput,
          ...(startsAtInput !== undefined ? { startsAt } : {}),
          ...(endsAtInput !== undefined ? { endsAt } : {}),
          ...(registrationStartsAtInput !== undefined
            ? {
                registrationStartsAt: registrationStartsAtInput
                  ? new Date(registrationStartsAtInput)
                  : null,
              }
            : {}),
          ...(registrationEndsAtInput !== undefined
            ? {
                registrationEndsAt: registrationEndsAtInput
                  ? new Date(registrationEndsAtInput)
                  : null,
              }
            : {}),
          ...(input.registrationsOpen !== undefined
            ? { registrationsClosedAt: input.registrationsOpen ? null : new Date() }
            : {}),
          updatedById: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(contests.id, id))
        .returning(contestSelection);
      if (!updated) throw new Error("Contest update failed");
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
    if (existing.status !== "DRAFT" && existing.status !== "CANCELLED") {
      throw conflict(
        "Annulez le concours avant de le supprimer.",
        "CONTEST_DELETE_REQUIRES_CANCELLATION",
      );
    }
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
      select p.*,u.display_name,u.public_slug,u.telegram_username,u.profile_photo_url,u.role,
        e.slug entry_slug,e.name entry_name,e.status entry_status,
        w.id winner_id,w.rank winner_rank,w.label winner_label
      from contest_participations p
      join users u on u.id=p.user_id
      left join entries e on e.id=p.entry_id
      left join contest_winners w on w.participation_id=p.id and w.contest_id=p.contest_id
      where p.contest_id=$1::uuid
        and ($2::contest_participation_status is null or p.status=$2::contest_participation_status)
        and ($3::text is null or u.display_name ilike '%' || $3 || '%'
          or coalesce(u.telegram_username,'') ilike '%' || $3 || '%'
          or coalesce(e.name,'') ilike '%' || $3 || '%')
    ), page as (
      select * from filtered
      order by case status when 'PENDING_REVIEW' then 0 when 'APPROVED' then 1 else 2 end,
        submitted_at desc limit $4 offset $5
    )
    select coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb) items,
      (select count(*)::int from filtered) total`,
    [contest.id, query.status ?? null, query.query ?? null, query.limit, query.offset],
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
        .select({ id: contests.id, status: contests.status, endsAt: contests.endsAt })
        .from(contests)
        .where(and(eq(contests.id, contestId), isNull(contests.deletedAt)))
        .limit(1)
        .for("update");
      if (!contest) throw notFound("Concours");
      if (
        contest.status === "DRAFT" ||
        contest.status === "CANCELLED" ||
        (contest.status !== "ENDED" && contest.endsAt > new Date())
      ) {
        throw conflict(
          "Les gagnants se choisissent après la fin du concours.",
          "CONTEST_NOT_ENDED",
        );
      }
      const [participation] = await tx
        .select({ id: contestParticipations.id, status: contestParticipations.status })
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
          metadata: { contestId, participationId: input.participationId },
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
