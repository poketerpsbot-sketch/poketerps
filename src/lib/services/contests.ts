import "server-only";

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import {
  auditLogs,
  contestParticipations,
  contests,
  contestWinners,
  entries,
} from "@/lib/db/schema";
import { conflict, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import { publicStorageUrl } from "@/lib/services/storage-url";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import type {
  contestLeaderboardQuerySchema,
  contestParticipationInputSchema,
  contestsQuerySchema,
} from "@/lib/validation/contests";

type ContestQuery = z.infer<typeof contestsQuerySchema>;
type LeaderboardQuery = z.infer<typeof contestLeaderboardQuerySchema>;
type ParticipationInput = z.infer<typeof contestParticipationInputSchema>;

export type ContestPhase = "UPCOMING" | "ACTIVE" | "ENDED";

type ContestRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  rules: string;
  image_url: string | null;
  status:
    | "DRAFT"
    | "UPCOMING"
    | "OPEN"
    | "FULL"
    | "CLOSED"
    | "SCHEDULED"
    | "ACTIVE"
    | "PAUSED"
    | "ENDED"
    | "CANCELLED";
  contest_type: "GAME" | "DRAW" | "CREATIVE" | "ENTRY" | "EXTERNAL_LINK" | "COMMUNITY" | "OTHER";
  is_featured: boolean;
  starts_at: Date | string;
  ends_at: Date | string;
  scoring_mode:
    "MANUAL" | "ENTRY_LIKES" | "ENTRY_VIEWS" | "ENTRY_FAVORITES" | "ENTRY_RATING" | "COMPOSITE";
  criteria: Record<string, unknown>;
  reward: Record<string, unknown>;
  reward_badge_id: string | null;
  max_participants: number | string | null;
  require_entry: boolean;
  instructions: string;
  participation_steps: string[];
  external_url: string | null;
  telegram_url: string | null;
  instagram_url: string | null;
  terms: string | null;
  additional_information: string | null;
  registrations_open: boolean;
  registration_starts_at: Date | string | null;
  registration_ends_at: Date | string | null;
  participant_count: number | string;
  capacity_count: number | string;
};

type PublicParticipant = {
  id: string;
  publicSlug: string;
  displayName: string;
  username: string | null;
  profilePhotoUrl: string | null;
};

export type ContestCard = ReturnType<typeof contestCardDto>;
export type ContestDetail = ContestCard & {
  description: string;
  rules: string;
  criteria: Record<string, unknown>;
  rewardBadge: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
  } | null;
  maxParticipants: number | null;
  requireEntry: boolean;
  instructions: string;
  participationSteps: string[];
  externalUrl: string | null;
  telegramUrl: string | null;
  instagramUrl: string | null;
  terms: string | null;
  additionalInformation: string | null;
  registrationStartsAt: Date | string | null;
  registrationEndsAt: Date | string | null;
  winners: ContestWinnerDto[];
  viewerParticipation: ContestParticipationDto | null;
};

export type ContestParticipationDto = {
  id: string;
  contestId: string;
  entryId: string | null;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "DISQUALIFIED";
  statement: string | null;
  submittedAt: Date | string;
  updatedAt: Date | string;
  withdrawnAt: Date | string | null;
};

export type ContestWinnerDto = {
  id: string;
  rank: number;
  label: string | null;
  prize: Record<string, unknown>;
  awardedAt: Date | string;
  participant: PublicParticipant;
};

export type ContestLeaderboardItem = {
  rank: number;
  score: number;
  participant: PublicParticipant;
  entry: {
    id: string;
    slug: string;
    name: string;
    primaryImageUrl: string | null;
  } | null;
  submittedAt: Date | string;
  isWinner: boolean;
  winner: { rank: number; label: string | null; prize: Record<string, unknown> } | null;
};

function participationDto(row: typeof contestParticipations.$inferSelect): ContestParticipationDto {
  return {
    id: row.id,
    contestId: row.contestId,
    entryId: row.entryId,
    status: row.status,
    statement: row.statement,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
    withdrawnAt: row.withdrawnAt,
  };
}

function phaseFor(startsAt: Date | string, endsAt: Date | string, now = new Date()): ContestPhase {
  if (new Date(endsAt) <= now) return "ENDED";
  if (new Date(startsAt) > now) return "UPCOMING";
  return "ACTIVE";
}

function contestCardDto(row: ContestRow) {
  const phase = phaseFor(row.starts_at, row.ends_at);
  const maxParticipants = row.max_participants === null ? null : Number(row.max_participants);
  const participantCount = Number(row.participant_count);
  const capacityCount = Number(row.capacity_count);
  const remainingParticipants =
    maxParticipants === null ? null : Math.max(0, maxParticipants - capacityCount);
  const now = new Date();
  const registrationStarted =
    row.registration_starts_at === null || new Date(row.registration_starts_at) <= now;
  const registrationNotEnded =
    row.registration_ends_at === null || new Date(row.registration_ends_at) > now;
  const isFull = maxParticipants !== null && capacityCount >= maxParticipants;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    imageUrl: row.image_url,
    status: row.status,
    phase,
    isFeatured: row.is_featured,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    scoringMode: row.scoring_mode,
    reward: row.reward,
    participantCount,
    maxParticipants,
    remainingParticipants,
    isFull,
    registrationsOpen: row.registrations_open,
    contestType: row.contest_type,
    participationOpen:
      phase === "ACTIVE" &&
      ["OPEN", "ACTIVE"].includes(row.status) &&
      row.registrations_open &&
      registrationStarted &&
      registrationNotEnded &&
      !isFull,
  };
}

const publicContestStatusSql = `c.status in ('UPCOMING','OPEN','FULL','CLOSED','SCHEDULED','ACTIVE','PAUSED','ENDED')`;
const phaseSql = `case
  when c.ends_at <= now() then 'ended'
  when c.starts_at > now() then 'upcoming'
  else 'active'
end`;

export async function listPublicContests(query: ContestQuery) {
  const sqlClient = getSqlClient();
  const [envelope] = await sqlClient.unsafe<
    { items: ContestRow[] | null; total: number | string }[]
  >(
    `with eligible as (
      select c.*,
        (select count(*)::int from contest_participations p
          where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) participant_count,
        (select count(*)::int from contest_participations p
          where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) capacity_count,
        ${phaseSql} phase
      from contests c
      where c.deleted_at is null and ${publicContestStatusSql}
        and ($1='all' or ${phaseSql}=$1)
        and ($2::boolean is null or c.is_featured=$2)
    ), page as (
      select * from eligible
      order by is_featured desc,
        case phase when 'active' then 0 when 'upcoming' then 1 else 2 end,
        case when phase='ended' then ends_at end desc,
        starts_at asc
      limit $3 offset $4
    )
    select coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb) items,
      (select count(*)::int from eligible) total`,
    [query.phase, query.featured ?? null, query.limit, query.offset],
  );
  return {
    contests: (envelope?.items ?? []).map(contestCardDto),
    total: Number(envelope?.total ?? 0),
  };
}

async function readPublicContestRow(slug: string): Promise<ContestRow> {
  const sqlClient = getSqlClient();
  const [row] = await sqlClient<ContestRow[]>`
    select c.*,
      (select count(*)::int from contest_participations p
        where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) participant_count,
      (select count(*)::int from contest_participations p
        where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) capacity_count
    from contests c
    where c.slug=${slug} and c.deleted_at is null
      and c.status in ('UPCOMING','OPEN','FULL','CLOSED','SCHEDULED','ACTIVE','PAUSED','ENDED')
    limit 1
  `;
  if (!row) throw notFound("Concours");
  return row;
}

async function listContestWinners(contestId: string): Promise<ContestWinnerDto[]> {
  const sqlClient = getSqlClient();
  const rows = await sqlClient<
    {
      id: string;
      rank: number | string;
      label: string | null;
      prize: Record<string, unknown>;
      awarded_at: Date | string;
      user_id: string;
      public_slug: string;
      display_name: string;
      telegram_username: string | null;
      profile_photo_url: string | null;
    }[]
  >`
    select w.id,w.rank,w.label,w.prize,w.awarded_at,
      u.id user_id,u.public_slug,u.display_name,u.telegram_username,u.profile_photo_url
    from contest_winners w
    join contest_participations p on p.id=w.participation_id and p.contest_id=w.contest_id
    join users u on u.id=p.user_id
    where w.contest_id=${contestId} and p.status='APPROVED'
      and u.account_kind='TELEGRAM' and not u.is_system
      and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED'
    order by w.rank,w.awarded_at
  `;
  return rows.map((row) => ({
    id: row.id,
    rank: Number(row.rank),
    label: row.label,
    prize: row.prize,
    awardedAt: row.awarded_at,
    participant: {
      id: row.user_id,
      publicSlug: row.public_slug,
      displayName: row.display_name,
      username: row.telegram_username,
      profilePhotoUrl: row.profile_photo_url,
    },
  }));
}

async function getViewerParticipation(contestId: string, userId?: string | null) {
  if (!userId) return null;
  const [row] = await getDb()
    .select({
      id: contestParticipations.id,
      contestId: contestParticipations.contestId,
      entryId: contestParticipations.entryId,
      status: contestParticipations.status,
      statement: contestParticipations.statement,
      submittedAt: contestParticipations.submittedAt,
      updatedAt: contestParticipations.updatedAt,
      withdrawnAt: contestParticipations.withdrawnAt,
    })
    .from(contestParticipations)
    .where(
      and(eq(contestParticipations.contestId, contestId), eq(contestParticipations.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function getPublicContest(slug: string, viewerUserId?: string | null) {
  const row = await readPublicContestRow(slug);
  const [winners, viewerParticipation, rewardBadge] = await Promise.all([
    listContestWinners(row.id),
    getViewerParticipation(row.id, viewerUserId),
    row.reward_badge_id
      ? getDb().query.badges.findFirst({
          columns: { id: true, slug: true, name: true, description: true, icon: true },
          where: (badge, operators) =>
            operators.and(
              operators.eq(badge.id, row.reward_badge_id!),
              operators.eq(badge.isActive, true),
            ),
        })
      : Promise.resolve(undefined),
  ]);
  return {
    ...contestCardDto(row),
    description: row.description,
    rules: row.rules,
    criteria: row.criteria,
    rewardBadge: rewardBadge ?? null,
    maxParticipants: row.max_participants === null ? null : Number(row.max_participants),
    requireEntry: row.require_entry,
    instructions: row.instructions,
    participationSteps: Array.isArray(row.participation_steps) ? row.participation_steps : [],
    externalUrl: row.external_url,
    telegramUrl: row.telegram_url,
    instagramUrl: row.instagram_url,
    terms: row.terms,
    additionalInformation: row.additional_information,
    registrationStartsAt: row.registration_starts_at,
    registrationEndsAt: row.registration_ends_at,
    winners,
    viewerParticipation,
  } satisfies ContestDetail;
}

type LeaderboardRow = {
  rank: number | string;
  score: number | string;
  submitted_at: Date | string;
  user_id: string;
  public_slug: string;
  display_name: string;
  telegram_username: string | null;
  profile_photo_url: string | null;
  entry_id: string | null;
  entry_slug: string | null;
  entry_name: string | null;
  primary_image_path: string | null;
  winner_rank: number | string | null;
  winner_label: string | null;
  winner_prize: Record<string, unknown> | null;
};

export async function getContestLeaderboard(slug: string, query: LeaderboardQuery) {
  const contest = await readPublicContestRow(slug);
  const sqlClient = getSqlClient();
  const [envelope] = await sqlClient.unsafe<
    { items: LeaderboardRow[] | null; total: number | string }[]
  >(
    `with scored as (
      select p.id,p.submitted_at,u.id user_id,u.public_slug,u.display_name,
        u.telegram_username,u.profile_photo_url,
        e.id entry_id,e.slug entry_slug,e.name entry_name,
        (select i.object_path from entry_images i where i.entry_id=e.id
          and i.deleted_at is null order by i.is_primary desc,i.sort_order limit 1) primary_image_path,
        case c.scoring_mode
          when 'MANUAL' then p.manual_score
          when 'ENTRY_LIKES' then coalesce(e.like_count,0)::numeric
          when 'ENTRY_VIEWS' then coalesce(e.view_count,0)::numeric
          when 'ENTRY_FAVORITES' then coalesce(e.favorite_count,0)::numeric
          when 'ENTRY_RATING' then coalesce(e.average_rating,0)::numeric
          when 'COMPOSITE' then
            coalesce(e.like_count,0) * case when jsonb_typeof(c.criteria->'weights'->'likes')='number'
              then (c.criteria->'weights'->>'likes')::numeric else 1 end
            + coalesce(e.view_count,0) * case when jsonb_typeof(c.criteria->'weights'->'views')='number'
              then (c.criteria->'weights'->>'views')::numeric else 0.1 end
            + coalesce(e.favorite_count,0) * case when jsonb_typeof(c.criteria->'weights'->'favorites')='number'
              then (c.criteria->'weights'->>'favorites')::numeric else 2 end
            + coalesce(e.average_rating,0) * case when jsonb_typeof(c.criteria->'weights'->'rating')='number'
              then (c.criteria->'weights'->>'rating')::numeric else 1 end
        end score
      from contest_participations p
      join contests c on c.id=p.contest_id
      join users u on u.id=p.user_id
      left join entries e on e.id=p.entry_id
      where p.contest_id=$1::uuid and p.status='APPROVED'
        and u.account_kind='TELEGRAM' and not u.is_system
        and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED'
        and (p.entry_id is null or (e.status='PUBLISHED' and e.deleted_at is null))
    ), ranked as (
      select dense_rank() over(order by score desc,submitted_at asc)::int rank,* from scored
    ), page as (
      select r.*,w.rank winner_rank,w.label winner_label,w.prize winner_prize
      from ranked r left join contest_winners w on w.participation_id=r.id and w.contest_id=$1::uuid
      order by r.rank,r.submitted_at limit $2 offset $3
    )
    select coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb) items,
      (select count(*)::int from ranked) total`,
    [contest.id, query.limit, query.offset],
  );
  return {
    items: (envelope?.items ?? []).map((row): ContestLeaderboardItem => ({
      rank: Number(row.rank),
      score: Number(row.score),
      participant: {
        id: row.user_id,
        publicSlug: row.public_slug,
        displayName: row.display_name,
        username: row.telegram_username,
        profilePhotoUrl: row.profile_photo_url,
      },
      entry: row.entry_id
        ? {
            id: row.entry_id,
            slug: row.entry_slug!,
            name: row.entry_name!,
            primaryImageUrl: publicStorageUrl("entry-images", row.primary_image_path),
          }
        : null,
      submittedAt: row.submitted_at,
      isWinner: row.winner_rank !== null,
      winner:
        row.winner_rank === null
          ? null
          : {
              rank: Number(row.winner_rank),
              label: row.winner_label,
              prize: row.winner_prize ?? {},
            },
    })),
    total: Number(envelope?.total ?? 0),
  };
}

async function assertEligibleEntry(entryId: string, userId: string) {
  const [entry] = await getDb()
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.id, entryId),
        eq(entries.originalContributorId, userId),
        eq(entries.status, "PUBLISHED"),
        eq(entries.isDemo, false),
        isNull(entries.deletedAt),
      ),
    )
    .limit(1);
  if (!entry) {
    throw conflict("La fiche doit être une de vos captures publiées.", "CONTEST_ENTRY_INELIGIBLE");
  }
}

export async function joinContest(
  slug: string,
  input: ParticipationInput,
  actor: CurrentUser,
  requestId?: string,
) {
  const db = getDb();
  const participation = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${slug}:${actor.id}`},0))`,
    );
    const [contest] = await tx
      .select()
      .from(contests)
      .where(and(eq(contests.slug, slug), isNull(contests.deletedAt)))
      .limit(1)
      .for("update");
    if (!contest || !["OPEN", "ACTIVE"].includes(contest.status)) {
      throw notFound("Concours actif");
    }
    const now = new Date();
    if (
      !contest.registrationsOpen ||
      contest.startsAt > now ||
      contest.endsAt <= now ||
      (contest.registrationStartsAt && contest.registrationStartsAt > now) ||
      (contest.registrationEndsAt && contest.registrationEndsAt <= now)
    ) {
      throw conflict("Les participations ne sont pas ouvertes.", "CONTEST_CLOSED");
    }
    if (contest.requireEntry && !input.entryId) {
      throw conflict("Une fiche publiée est requise.", "CONTEST_ENTRY_REQUIRED");
    }
    if (input.entryId) await assertEligibleEntry(input.entryId, actor.id);

    const [existing] = await tx
      .select()
      .from(contestParticipations)
      .where(
        and(
          eq(contestParticipations.contestId, contest.id),
          eq(contestParticipations.userId, actor.id),
        ),
      )
      .limit(1)
      .for("update");
    if (existing && existing.status !== "WITHDRAWN") {
      throw conflict("Vous participez déjà à ce concours.", "CONTEST_ALREADY_JOINED");
    }
    if (contest.maxParticipants !== null) {
      const [total] = await tx
        .select({ value: count() })
        .from(contestParticipations)
        .where(
          and(
            eq(contestParticipations.contestId, contest.id),
            inArray(contestParticipations.status, ["PENDING_REVIEW", "APPROVED"]),
          ),
        );
      if (Number(total?.value ?? 0) >= contest.maxParticipants) {
        throw conflict("Le concours a atteint sa capacité maximale.", "CONTEST_FULL");
      }
    }

    const values = {
      entryId: input.entryId ?? null,
      statement: input.statement ?? null,
      status: "PENDING_REVIEW" as const,
      submittedAt: now,
      updatedAt: now,
      withdrawnAt: null,
      moderatedById: null,
      moderatedAt: null,
      moderationNote: null,
      manualScore: "0",
      scoreBreakdown: {},
    };
    const [participation] = existing
      ? await tx
          .update(contestParticipations)
          .set(values)
          .where(eq(contestParticipations.id, existing.id))
          .returning()
      : await tx
          .insert(contestParticipations)
          .values({ ...values, contestId: contest.id, userId: actor.id })
          .returning();
    if (!participation) throw new Error("Contest participation insert failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: existing ? "CONTEST_REJOINED" : "CONTEST_JOINED",
        entityType: "CONTEST_PARTICIPATION",
        entityId: participation.id,
        source: "API",
        requestId,
        after: participation,
        metadata: { contestId: contest.id },
      }),
    );
    return participationDto(participation);
  });
  await tryRecordUserActivityEvent({
    userId: actor.id,
    eventType: "CONTEST_JOIN",
    entityType: "CONTEST_PARTICIPATION",
    entityId: String(participation.id),
    metadata: { contestSlug: slug },
  });
  return participation;
}

export async function withdrawFromContest(slug: string, actor: CurrentUser, requestId?: string) {
  return getDb().transaction(async (tx) => {
    const [contest] = await tx
      .select({ id: contests.id, status: contests.status, endsAt: contests.endsAt })
      .from(contests)
      .where(and(eq(contests.slug, slug), isNull(contests.deletedAt)))
      .limit(1);
    if (!contest) throw notFound("Concours");
    if (
      contest.endsAt <= new Date() ||
      contest.status === "ENDED" ||
      contest.status === "CANCELLED" ||
      contest.status === "DRAFT"
    ) {
      throw conflict("Ce concours est terminé.", "CONTEST_CLOSED");
    }
    const [participation] = await tx
      .select()
      .from(contestParticipations)
      .where(
        and(
          eq(contestParticipations.contestId, contest.id),
          eq(contestParticipations.userId, actor.id),
        ),
      )
      .limit(1)
      .for("update");
    if (!participation || participation.status === "WITHDRAWN") {
      throw notFound("Participation");
    }
    const winner = await tx
      .select({ id: contestWinners.id })
      .from(contestWinners)
      .where(eq(contestWinners.participationId, participation.id))
      .limit(1);
    if (winner[0]) {
      throw conflict(
        "Une participation gagnante ne peut pas être retirée.",
        "CONTEST_WINNER_LOCKED",
      );
    }
    const now = new Date();
    const [updated] = await tx
      .update(contestParticipations)
      .set({ status: "WITHDRAWN", withdrawnAt: now, updatedAt: now })
      .where(eq(contestParticipations.id, participation.id))
      .returning();
    if (!updated) throw new Error("Contest withdrawal failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "CONTEST_WITHDRAWN",
        entityType: "CONTEST_PARTICIPATION",
        entityId: participation.id,
        source: "API",
        requestId,
        before: participation,
        after: updated,
        metadata: { contestId: contest.id },
      }),
    );
    return participationDto(updated);
  });
}
