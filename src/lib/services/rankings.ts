import "server-only";

import { getSqlClient } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { publicStorageUrl } from "@/lib/services/storage-url";

export type RankingPeriod = "week" | "month" | "all";
export type EntryRankingMetric = "views" | "likes" | "rating" | "recent";

const periodBoundarySql = `case
  when $1 = 'week' then date_trunc('week', now() at time zone $2) at time zone $2
  when $1 = 'month' then date_trunc('month', now() at time zone $2) at time zone $2
  else '-infinity'::timestamptz
end`;

type RawTrainerRanking = {
  rank: number | string;
  user_id: string;
  slug: string;
  display_name: string;
  username: string | null;
  profile_photo_url: string | null;
  profile_title: string | null;
  level: number | string;
  experience_points: number | string;
  period_captures: number | string;
  total_captures: number | string;
  period_likes_received: number | string;
  total_likes_received: number | string;
  period_views_received: number | string;
  total_views_received: number | string;
  badge_id: string | null;
  badge_slug: string | null;
  badge_name: string | null;
  badge_icon: string | null;
};

type RawTrainerRankingEnvelope = {
  items: RawTrainerRanking[] | null;
  total: number | string;
  current_user: RawTrainerRanking | null;
};

function trainerRankingDto(row: RawTrainerRanking) {
  return {
    rank: Number(row.rank),
    userId: row.user_id,
    slug: row.slug,
    publicSlug: row.slug,
    displayName: row.display_name,
    username: row.username,
    telegramUsername: row.username,
    profilePhotoUrl: row.profile_photo_url,
    profileTitle: row.profile_title,
    level: Number(row.level),
    experiencePoints: Number(row.experience_points),
    captures: Number(row.period_captures),
    periodCaptures: Number(row.period_captures),
    totalCaptures: Number(row.total_captures),
    likesReceived: Number(row.period_likes_received),
    totalLikesReceived: Number(row.total_likes_received),
    viewsReceived: Number(row.period_views_received),
    totalViewsReceived: Number(row.total_views_received),
    badge: row.badge_name
      ? {
          id: row.badge_id ?? undefined,
          slug: row.badge_slug,
          name: row.badge_name,
          icon: row.badge_icon,
        }
      : null,
  };
}

export async function getTrainerRankingPage(
  period: RankingPeriod,
  limit: number,
  offset: number,
  viewerUserId?: string | null,
) {
  const timezone = getEnv().APP_TIMEZONE;
  const sql = getSqlClient();
  const [envelope] = await sql.unsafe<RawTrainerRankingEnvelope[]>(
    `with eligible_entries as (
      select e.id, e.original_contributor_id, e.published_at
      from entries e
      join users contributor on contributor.id=e.original_contributor_id
      where e.status='PUBLISHED' and e.deleted_at is null and e.is_demo=false
        and contributor.account_kind='TELEGRAM' and contributor.is_system=false
        and contributor.profile_visibility='PUBLIC'
        and contributor.is_banned=false and contributor.role <> 'BANNED'
    ), capture_stats as (
      select original_contributor_id user_id,
        count(*) filter (where published_at >= ${periodBoundarySql})::int period_captures,
        count(*)::int total_captures
      from eligible_entries group by original_contributor_id
    ), like_stats as (
      select e.original_contributor_id user_id,
        count(l.id) filter (where l.created_at >= ${periodBoundarySql})::int period_likes_received,
        count(l.id)::int total_likes_received
      from eligible_entries e join entry_likes l on l.entry_id=e.id
      group by e.original_contributor_id
    ), view_stats as (
      select e.original_contributor_id user_id,
        count(v.id) filter (where v.created_at >= ${periodBoundarySql})::int period_views_received,
        count(v.id)::int total_views_received
      from eligible_entries e join entry_view_events v on v.entry_id=e.id
      group by e.original_contributor_id
    ), trainer_stats as (
      select u.id user_id, u.public_slug slug, u.display_name,
        u.telegram_username username, u.profile_photo_url, u.profile_title,
        u.level, u.experience_points,
        captures.period_captures, captures.total_captures,
        coalesce(likes.period_likes_received, 0)::int period_likes_received,
        coalesce(likes.total_likes_received, 0)::int total_likes_received,
        coalesce(views.period_views_received, 0)::int period_views_received,
        coalesce(views.total_views_received, 0)::int total_views_received,
        featured_badge.id badge_id, featured_badge.slug badge_slug,
        featured_badge.name badge_name, featured_badge.icon badge_icon
      from users u
      join capture_stats captures on captures.user_id=u.id
      left join like_stats likes on likes.user_id=u.id
      left join view_stats views on views.user_id=u.id
      left join lateral (
        select b.id, b.slug, b.name, b.icon
        from user_badges ub join badges b on b.id=ub.badge_id
        where ub.user_id=u.id and ub.is_active=true and b.is_active=true
          and (ub.active_from is null or ub.active_from <= now())
          and (ub.active_until is null or ub.active_until > now())
        order by b.sort_order desc, ub.awarded_at desc limit 1
      ) featured_badge on true
      where u.account_kind='TELEGRAM' and u.is_system=false
        and u.profile_visibility='PUBLIC' and u.is_banned=false and u.role <> 'BANNED'
    ), ranked as (
      select dense_rank() over (
        order by period_captures desc, period_likes_received desc,
          period_views_received desc, total_captures desc
      )::int rank, *
      from trainer_stats where period_captures > 0
    ), page as (
      select * from ranked order by rank, slug limit $3 offset $4
    )
    select
      coalesce((select jsonb_agg(to_jsonb(page) order by page.rank, page.slug) from page), '[]'::jsonb) items,
      (select count(*)::int from ranked) total,
      (select to_jsonb(ranked) from ranked where user_id=$5::uuid) current_user`,
    [period, timezone, limit, offset, viewerUserId ?? null],
  );

  const items = (envelope?.items ?? []).map(trainerRankingDto);
  return {
    items,
    total: Number(envelope?.total ?? 0),
    currentUser: envelope?.current_user ? trainerRankingDto(envelope.current_user) : null,
  };
}

export async function getTrainerRankings(period: RankingPeriod, limit: number, offset: number) {
  return (await getTrainerRankingPage(period, limit, offset)).items;
}

type RawEntryRanking = {
  rank: number | string;
  id: string;
  public_number: number | string;
  slug: string;
  name: string;
  average_rating: number | string;
  view_count: number | string;
  like_count: number | string;
  review_count: number | string;
  published_at: Date | string;
  category_slug: string;
  category_name: string;
  primary_image_path: string | null;
  metric_value: number | string;
};

type RawEntryRankingEnvelope = {
  items: RawEntryRanking[] | null;
  total: number | string;
};

function entryRankingDto(row: RawEntryRanking) {
  return {
    rank: Number(row.rank),
    id: row.id,
    publicNumber: Number(row.public_number),
    slug: row.slug,
    name: row.name,
    averageRating: Number(row.average_rating),
    viewCount: Number(row.view_count),
    likeCount: Number(row.like_count),
    reviewCount: Number(row.review_count),
    publishedAt: row.published_at,
    category: { slug: row.category_slug, name: row.category_name },
    primaryImageUrl: publicStorageUrl("entry-images", row.primary_image_path),
    metricValue: Number(row.metric_value),
  };
}

export async function getEntryRankingPage(
  metric: EntryRankingMetric,
  period: RankingPeriod,
  limit: number,
  offset: number,
) {
  const timezone = getEnv().APP_TIMEZONE;
  const eventJoin =
    metric === "views"
      ? "left join entry_view_events ev on ev.entry_id = e.id and ev.created_at >= " +
        periodBoundarySql
      : metric === "likes"
        ? "left join entry_likes ev on ev.entry_id = e.id and ev.created_at >= " + periodBoundarySql
        : "";
  const metricExpression =
    metric === "views" || metric === "likes"
      ? "count(ev.id)::numeric"
      : metric === "rating"
        ? "e.average_rating::numeric"
        : "extract(epoch from e.published_at)::numeric";
  const periodFilter =
    metric === "rating" || metric === "recent" ? `and e.published_at >= ${periodBoundarySql}` : "";
  const sql = getSqlClient();
  const [envelope] = await sql.unsafe<RawEntryRankingEnvelope[]>(
    `with scored as (
      select e.id, e.public_number, e.slug, e.name, e.average_rating, e.view_count,
        e.like_count, e.review_count, e.published_at, c.slug category_slug, c.name category_name,
        (select object_path from entry_images i where i.entry_id=e.id and i.deleted_at is null
          order by i.is_primary desc, i.sort_order asc limit 1) primary_image_path,
        ${metricExpression} metric_value
      from entries e
      join categories c on c.id=e.category_id
      join users contributor on contributor.id=e.original_contributor_id
      ${eventJoin}
      where e.status='PUBLISHED' and e.deleted_at is null and e.is_demo=false
        and contributor.account_kind='TELEGRAM' and contributor.is_system=false
        and contributor.profile_visibility='PUBLIC'
        and contributor.is_banned=false and contributor.role <> 'BANNED'
        ${periodFilter}
      group by e.id, c.id
    ), ranked as (
      select dense_rank() over (order by metric_value desc, published_at desc)::int rank, *
      from scored where metric_value > 0
    ), page as (
      select * from ranked order by rank, published_at desc limit $3 offset $4
    )
    select
      coalesce((select jsonb_agg(to_jsonb(page) order by page.rank, page.published_at desc) from page), '[]'::jsonb) items,
      (select count(*)::int from ranked) total`,
    [period, timezone, limit, offset],
  );

  return {
    items: (envelope?.items ?? []).map(entryRankingDto),
    total: Number(envelope?.total ?? 0),
  };
}

export async function getEntryRankings(
  metric: EntryRankingMetric,
  period: RankingPeriod,
  limit: number,
  offset: number,
) {
  return (await getEntryRankingPage(metric, period, limit, offset)).items;
}
