import "server-only";

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import {
  contestParticipationError,
  effectiveContestDates,
  getContestEffectiveStatus,
} from "@/lib/contests/effective-status";
import { getDb, getSqlClient } from "@/lib/db";
import {
  auditLogs,
  contestGuesses,
  contestLinks,
  contestParticipations,
  contestViewEvents,
  contests,
  contestWinners,
  entries,
} from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { conflict, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import { publicStorageUrl, signedStorageUrls } from "@/lib/services/storage-url";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import type {
  contestEventInputSchema,
  contestGuessInputSchema,
  contestHallOfFameQuerySchema,
  contestLeaderboardQuerySchema,
  contestParticipationInputSchema,
  contestsQuerySchema,
} from "@/lib/validation/contests";

type ContestQuery = z.infer<typeof contestsQuerySchema>;
type LeaderboardQuery = z.infer<typeof contestLeaderboardQuerySchema>;
type HallOfFameQuery = z.infer<typeof contestHallOfFameQuerySchema>;
type ParticipationInput = z.infer<typeof contestParticipationInputSchema>;
type GuessInput = z.infer<typeof contestGuessInputSchema>;
type ContestEventInput = z.infer<typeof contestEventInputSchema>;

export type ContestPhase = "UPCOMING" | "ACTIVE" | "ENDED";

type ContestRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  public_intro: string | null;
  short_rules: string | null;
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
    | "CANCELLED"
    | "ENDED_PENDING_RESULT";
  contest_type:
    | "GAME"
    | "DRAW"
    | "CREATIVE"
    | "ENTRY"
    | "EXTERNAL_LINK"
    | "COMMUNITY"
    | "OTHER"
    | "WEIGHT_GUESS";
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
  registrations_open: boolean;
  registrations_manually_closed: boolean;
  registration_starts_at: Date | string | null;
  registration_ends_at: Date | string | null;
  result_published_at: Date | string | null;
  main_image_bucket: string | null;
  main_image_path: string | null;
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
  publicIntro: string | null;
  shortRules: string | null;
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
  publicLinks: ContestLinkDto[];
  participantContent: ParticipantContestContent | null;
  result: ContestResultDto | null;
  registrationStartsAt: Date | string | null;
  registrationEndsAt: Date | string | null;
  winners: ContestWinnerDto[];
  viewerParticipation: ContestParticipationDto | null;
};

export type ContestLinkDto = {
  id: string;
  label: string;
  url: string;
  type: "WEBSITE" | "TELEGRAM" | "INSTAGRAM" | "OTHER";
  visibility: "PUBLIC" | "PARTICIPANTS_ONLY";
};

export type ParticipantContestContent = {
  longDescription: string | null;
  instructions: string | null;
  participationSteps: string[];
  fullRules: string | null;
  terms: string | null;
  additionalInformation: string | null;
  links: ContestLinkDto[];
  guess: {
    numericValue: number;
    unit: string;
    submittedAt: Date | string;
    updatedAt: Date | string;
  } | null;
  allowGuessEditing: boolean;
};

export type ContestResultDto = {
  text: string | null;
  imageUrl: string | null;
  weight: number | null;
  weightUnit: string | null;
  publishedAt: Date | string;
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

export type ContestHallOfFameWinnerDto = ContestWinnerDto & {
  guess: { numericValue: number; unit: string } | null;
};

export type ContestHallOfFameResultDto = {
  id: string;
  slug: string;
  title: string;
  contestType: ContestRow["contest_type"];
  endedAt: Date | string;
  resultPublishedAt: Date | string;
  resultText: string | null;
  resultImageUrl: string | null;
  resultWeight: number | null;
  weightUnit: string | null;
  winners: ContestHallOfFameWinnerDto[];
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

function contestCardDto(row: ContestRow) {
  const maxParticipants = row.max_participants === null ? null : Number(row.max_participants);
  const participantCount = Number(row.participant_count);
  const capacityCount = Number(row.capacity_count);
  const remainingParticipants =
    maxParticipants === null ? null : Math.max(0, maxParticipants - capacityCount);
  const dates = effectiveContestDates({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    registrationStartsAt: row.registration_starts_at,
    registrationEndsAt: row.registration_ends_at,
  });
  const effectiveStatus = getContestEffectiveStatus({
    status: row.status,
    ...dates,
    registrationsOpen: row.registrations_open,
    registrationsManuallyClosed: row.registrations_manually_closed,
    maxParticipants,
    participantCount: capacityCount,
    resultPublishedAt: row.result_published_at,
  });
  const phase: ContestPhase =
    effectiveStatus === "UPCOMING"
      ? "UPCOMING"
      : effectiveStatus === "ENDED" || effectiveStatus === "ENDED_PENDING_RESULT"
        ? "ENDED"
        : "ACTIVE";
  const isFull = effectiveStatus === "FULL";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    imageUrl:
      row.image_url ??
      (row.main_image_bucket && row.main_image_path
        ? publicStorageUrl(row.main_image_bucket, row.main_image_path)
        : null),
    status: effectiveStatus,
    phase,
    isFeatured: row.is_featured,
    startsAt: dates.startsAt,
    endsAt: dates.endsAt,
    scoringMode: row.scoring_mode,
    reward: row.reward,
    participantCount,
    maxParticipants,
    remainingParticipants,
    isFull,
    registrationsOpen: row.registrations_open,
    contestType: row.contest_type,
    participationOpen: effectiveStatus === "OPEN",
    timeZone: getEnv().APP_TIMEZONE,
  };
}

const publicContestStatusSql = `c.status::text not in ('DRAFT','CANCELLED')`;
const phaseSql = `case
  when coalesce(c.registration_ends_at,c.ends_at) <= now() then 'ended'
  when coalesce(c.registration_starts_at,c.starts_at) > now() then 'upcoming'
  else 'active'
end`;
const publicContestColumns = `c.id,c.slug,c.title,
  coalesce(c.short_description,c.summary) summary,
  coalesce(c.main_image_url,c.image_url) image_url,
  c.status,c.contest_type,c.is_featured,c.starts_at,c.ends_at,c.scoring_mode,c.criteria,c.reward,
  c.reward_badge_id,c.max_participants,c.require_entry,c.registrations_open,
  c.registrations_manually_closed,c.registration_starts_at,c.registration_ends_at,
  c.result_published_at,c.public_intro,c.short_rules,c.main_image_bucket,c.main_image_path`;

export async function listPublicContests(query: ContestQuery) {
  const sqlClient = getSqlClient();
  const [envelope] = await sqlClient.unsafe<
    { items: ContestRow[] | null; total: number | string }[]
  >(
    `with eligible as (
      select ${publicContestColumns},
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
  const rows = await sqlClient.unsafe<ContestRow[]>(
    `
    select ${publicContestColumns},
      (select count(*)::int from contest_participations p
        where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) participant_count,
      (select count(*)::int from contest_participations p
        where p.contest_id=c.id and p.status in ('PENDING_REVIEW','APPROVED')) capacity_count
    from contests c
    where c.slug=$1 and c.deleted_at is null and ${publicContestStatusSql}
    limit 1
  `,
    [slug],
  );
  const [row] = rows;
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

type HallOfFameRow = {
  id: string;
  slug: string;
  title: string;
  contest_type: ContestRow["contest_type"];
  ends_at: Date | string;
  result_published_at: Date | string;
  result_text: string | null;
  result_image_url: string | null;
  result_image_path: string | null;
  secret_weight: number | string | null;
  weight_unit: string | null;
  custom_weight_unit: string | null;
  winners: Array<{
    id: string;
    rank: number | string;
    label: string | null;
    prize: Record<string, unknown>;
    awarded_at: Date | string;
    participant: {
      id: string;
      public_slug: string;
      display_name: string;
      telegram_username: string | null;
      profile_photo_url: string | null;
    };
    guess: { numeric_value: number | string; unit: string } | null;
  }>;
};

export async function listContestHallOfFame(query: HallOfFameQuery) {
  const [envelope] = await getSqlClient().unsafe<
    Array<{ items: HallOfFameRow[] | null; total: number | string }>
  >(
    `with eligible as (
      select c.id,c.slug,c.title,c.contest_type,c.ends_at,c.result_published_at,
        c.result_text,c.result_image_url,c.result_image_path,c.secret_weight,
        c.weight_unit,c.custom_weight_unit
      from contests c
      where c.deleted_at is null
        and c.status::text='ENDED'
        and c.ends_at<=now()
        and c.result_published_at is not null
        and exists (
          select 1
          from contest_winners w
          join contest_participations cp
            on cp.id=w.participation_id and cp.contest_id=w.contest_id
          join users u on u.id=cp.user_id
          where w.contest_id=c.id and cp.status='APPROVED'
            and u.account_kind='TELEGRAM' and not u.is_system
            and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED'
        )
    ), page as (
      select * from eligible
      order by result_published_at desc,id desc
      limit $1 offset $2
    ), result_page as (
      select page.*,
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id',w.id,
              'rank',w.rank,
              'label',w.label,
              'prize',w.prize,
              'awarded_at',w.awarded_at,
              'participant',jsonb_build_object(
                'id',u.id,
                'public_slug',u.public_slug,
                'display_name',u.display_name,
                'telegram_username',u.telegram_username,
                'profile_photo_url',u.profile_photo_url
              ),
              'guess',case when g.id is null then null else jsonb_build_object(
                'numeric_value',g.numeric_value::float8,
                'unit',g.unit
              ) end
            ) order by w.rank,w.awarded_at,w.id
          )
          from contest_winners w
          join contest_participations cp
            on cp.id=w.participation_id and cp.contest_id=w.contest_id
          join users u on u.id=cp.user_id
          left join contest_guesses g on g.contest_id=w.contest_id and g.user_id=cp.user_id
          where w.contest_id=page.id and cp.status='APPROVED'
            and u.account_kind='TELEGRAM' and not u.is_system
            and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED'
        ),'[]'::jsonb) winners
      from page
    )
    select coalesce((
      select jsonb_agg(to_jsonb(result_page) order by result_published_at desc,id desc)
      from result_page
    ),'[]'::jsonb) items,
    (select count(*)::int from eligible) total`,
    [query.limit, query.offset],
  );
  const rows = envelope?.items ?? [];
  const signedImages = await signedStorageUrls(
    "contest-results",
    rows.flatMap((row) => (row.result_image_path ? [row.result_image_path] : [])),
  );
  const results: ContestHallOfFameResultDto[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    contestType: row.contest_type,
    endedAt: row.ends_at,
    resultPublishedAt: row.result_published_at,
    resultText: row.result_text,
    resultImageUrl:
      row.result_image_url ??
      (row.result_image_path ? (signedImages.get(row.result_image_path) ?? null) : null),
    resultWeight: row.secret_weight === null ? null : Number(row.secret_weight),
    weightUnit: row.weight_unit === "CUSTOM" ? row.custom_weight_unit : row.weight_unit,
    winners: row.winners.map((winner) => ({
      id: winner.id,
      rank: Number(winner.rank),
      label: winner.label,
      prize: winner.prize,
      awardedAt: winner.awarded_at,
      participant: {
        id: winner.participant.id,
        publicSlug: winner.participant.public_slug,
        displayName: winner.participant.display_name,
        username: winner.participant.telegram_username,
        profilePhotoUrl: winner.participant.profile_photo_url,
      },
      guess: winner.guess
        ? { numericValue: Number(winner.guess.numeric_value), unit: winner.guess.unit }
        : null,
    })),
  }));
  return { results, total: Number(envelope?.total ?? 0) };
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

async function listContestLinks(contestId: string, includeParticipantsOnly: boolean) {
  return getDb()
    .select({
      id: contestLinks.id,
      label: contestLinks.label,
      url: contestLinks.url,
      type: contestLinks.type,
      visibility: contestLinks.visibility,
    })
    .from(contestLinks)
    .where(
      includeParticipantsOnly
        ? eq(contestLinks.contestId, contestId)
        : and(eq(contestLinks.contestId, contestId), eq(contestLinks.visibility, "PUBLIC")),
    )
    .orderBy(contestLinks.displayOrder, contestLinks.id);
}

async function getParticipantContent(contestId: string, userId?: string | null) {
  if (!userId) return null;
  const [row] = await getSqlClient()<
    Array<{
      instructions: string | null;
      long_description: string | null;
      participation_steps: string[];
      full_rules: string | null;
      terms: string | null;
      additional_information: string | null;
      allow_guess_editing: boolean;
      guess_value: number | null;
      guess_unit: string | null;
      guess_submitted_at: Date | string | null;
      guess_updated_at: Date | string | null;
    }>
  >`
    select coalesce(c.participant_instructions,nullif(c.instructions,'')) instructions,
      coalesce(c.long_description,nullif(c.description,'')) long_description,
      c.participation_steps,coalesce(c.full_rules,c.rules) full_rules,c.terms,c.additional_information,
      c.allow_guess_editing,g.numeric_value::float8 guess_value,g.unit guess_unit,
      g.submitted_at guess_submitted_at,g.updated_at guess_updated_at
    from contests c join contest_participations p on p.contest_id=c.id
      and p.user_id=${userId}::uuid and p.status in ('PENDING_REVIEW','APPROVED')
    left join contest_guesses g on g.contest_id=c.id and g.user_id=p.user_id
    where c.id=${contestId}::uuid
    limit 1
  `;
  if (!row) return null;
  const links = await listContestLinks(contestId, true);
  return {
    instructions: row.instructions,
    longDescription: row.long_description,
    participationSteps: Array.isArray(row.participation_steps) ? row.participation_steps : [],
    fullRules: row.full_rules,
    terms: row.terms,
    additionalInformation: row.additional_information,
    links: links.filter((link) => link.visibility === "PARTICIPANTS_ONLY"),
    guess:
      row.guess_value === null ||
      !row.guess_unit ||
      !row.guess_submitted_at ||
      !row.guess_updated_at
        ? null
        : {
            numericValue: Number(row.guess_value),
            unit: row.guess_unit,
            submittedAt: row.guess_submitted_at,
            updatedAt: row.guess_updated_at,
          },
    allowGuessEditing: row.allow_guess_editing,
  } satisfies ParticipantContestContent;
}

async function getPublishedContestResult(contestId: string): Promise<ContestResultDto | null> {
  const [result] = await getSqlClient()<
    Array<{
      result_text: string | null;
      result_image_url: string | null;
      result_image_path: string | null;
      secret_weight: number | null;
      weight_unit: string | null;
      custom_weight_unit: string | null;
      result_published_at: Date | string;
    }>
  >`
    select result_text,result_image_url,result_image_path,secret_weight::float8 secret_weight,
      weight_unit,custom_weight_unit,result_published_at
    from contests
    where id=${contestId}::uuid and result_published_at is not null
    limit 1
  `;
  if (!result) return null;
  const signed = result.result_image_path
    ? await signedStorageUrls("contest-results", [result.result_image_path])
    : new Map<string, string>();
  return {
    text: result.result_text,
    imageUrl:
      result.result_image_url ??
      (result.result_image_path ? (signed.get(result.result_image_path) ?? null) : null),
    weight: result.secret_weight === null ? null : Number(result.secret_weight),
    weightUnit: result.weight_unit === "CUSTOM" ? result.custom_weight_unit : result.weight_unit,
    publishedAt: result.result_published_at,
  };
}

export async function getPublicContest(slug: string, viewerUserId?: string | null) {
  const row = await readPublicContestRow(slug);
  const [viewerParticipation, rewardBadge, publicLinks, participantContent, result] =
    await Promise.all([
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
      listContestLinks(row.id, false),
      getParticipantContent(row.id, viewerUserId),
      getPublishedContestResult(row.id),
    ]);
  const winners = result ? await listContestWinners(row.id) : [];
  return {
    ...contestCardDto(row),
    publicIntro: row.public_intro,
    shortRules: row.short_rules,
    criteria: row.criteria,
    rewardBadge: rewardBadge ?? null,
    maxParticipants: row.max_participants === null ? null : Number(row.max_participants),
    requireEntry: row.require_entry,
    publicLinks,
    participantContent,
    result,
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
    if (!contest) throw notFound("Concours");
    const now = new Date();
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
    const [total] = await tx
      .select({ value: count() })
      .from(contestParticipations)
      .where(
        and(
          eq(contestParticipations.contestId, contest.id),
          inArray(contestParticipations.status, ["PENDING_REVIEW", "APPROVED"]),
        ),
      );
    const participationError = contestParticipationError(
      getContestEffectiveStatus(
        {
          status: contest.status,
          startsAt: contest.startsAt,
          endsAt: contest.endsAt,
          registrationStartsAt: contest.registrationStartsAt,
          registrationEndsAt: contest.registrationEndsAt,
          registrationsOpen: contest.registrationsOpen,
          registrationsManuallyClosed: contest.registrationsManuallyClosed,
          maxParticipants: contest.maxParticipants,
          participantCount: Number(total?.value ?? 0),
          resultPublishedAt: contest.resultPublishedAt,
        },
        now,
      ),
    );
    if (participationError) {
      throw conflict(participationError.message, participationError.code);
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

export async function submitContestGuess(
  slug: string,
  input: GuessInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [contest] = await tx
      .select({
        id: contests.id,
        contestType: contests.contestType,
        endsAt: contests.endsAt,
        registrationEndsAt: contests.registrationEndsAt,
        weightUnit: contests.weightUnit,
        allowGuessEditing: contests.allowGuessEditing,
      })
      .from(contests)
      .where(and(eq(contests.slug, slug), isNull(contests.deletedAt)))
      .limit(1)
      .for("update");
    if (!contest || contest.contestType !== "WEIGHT_GUESS") throw notFound("Jeu du poids");
    if ((contest.registrationEndsAt ?? contest.endsAt) <= new Date()) {
      throw conflict("Ce concours est terminé.", "CONTEST_ENDED");
    }
    const [participation] = await tx
      .select({ id: contestParticipations.id, status: contestParticipations.status })
      .from(contestParticipations)
      .where(
        and(
          eq(contestParticipations.contestId, contest.id),
          eq(contestParticipations.userId, actor.id),
          inArray(contestParticipations.status, ["PENDING_REVIEW", "APPROVED"]),
        ),
      )
      .limit(1)
      .for("update");
    if (!participation) {
      throw conflict("Participe d’abord au concours.", "CONTEST_PARTICIPATION_REQUIRED");
    }
    const [existing] = await tx
      .select()
      .from(contestGuesses)
      .where(and(eq(contestGuesses.contestId, contest.id), eq(contestGuesses.userId, actor.id)))
      .limit(1)
      .for("update");
    if (existing && !contest.allowGuessEditing) {
      throw conflict("Ton estimation est déjà enregistrée.", "CONTEST_GUESS_LOCKED");
    }
    const now = new Date();
    const [guess] = existing
      ? await tx
          .update(contestGuesses)
          .set({
            numericValue: String(input.numericValue),
            submissionCount: existing.submissionCount + 1,
            updatedAt: now,
          })
          .where(eq(contestGuesses.id, existing.id))
          .returning()
      : await tx
          .insert(contestGuesses)
          .values({
            contestId: contest.id,
            userId: actor.id,
            participationId: participation.id,
            numericValue: String(input.numericValue),
            unit: contest.weightUnit ?? "g",
            submittedAt: now,
            updatedAt: now,
          })
          .returning();
    if (!guess) throw new Error("Contest guess insert failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: existing ? "CONTEST_GUESS_UPDATED" : "CONTEST_GUESS_SUBMITTED",
        entityType: "CONTEST_GUESS",
        entityId: guess.id,
        source: "API",
        requestId,
        before: existing,
        after: guess,
        metadata: { contestId: contest.id },
      }),
    );
    return {
      id: guess.id,
      numericValue: Number(guess.numericValue),
      unit: guess.unit,
      submittedAt: guess.submittedAt,
      updatedAt: guess.updatedAt,
    };
  });
}

export async function recordContestEvent(
  slug: string,
  input: ContestEventInput,
  viewerUserId?: string | null,
) {
  const [contest] = await getDb()
    .select({ id: contests.id })
    .from(contests)
    .where(and(eq(contests.slug, slug), isNull(contests.deletedAt)))
    .limit(1);
  if (!contest) throw notFound("Concours");
  const [event] = await getDb()
    .insert(contestViewEvents)
    .values({
      contestId: contest.id,
      userId: viewerUserId ?? null,
      eventType: input.eventType,
      metadata: input.linkId ? { linkId: input.linkId } : {},
    })
    .returning({ id: contestViewEvents.id });
  return event;
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
