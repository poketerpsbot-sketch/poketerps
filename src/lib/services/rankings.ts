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

export async function getTrainerRankings(period: RankingPeriod, limit: number, offset: number) {
  const timezone = getEnv().APP_TIMEZONE;
  const sql = getSqlClient();
  const rows = await sql.unsafe<
    Array<{
      rank: number;
      slug: string;
      display_name: string;
      username: string | null;
      profile_photo_url: string | null;
      profile_title: string | null;
      level: number;
      period_captures: number;
      total_captures: number;
    }>
  >(
    `with trainer_stats as (
      select u.public_slug as slug, u.display_name, u.telegram_username as username,
        u.profile_photo_url, u.profile_title, u.level,
        count(e.id) filter (where e.published_at >= ${periodBoundarySql})::int as period_captures,
        count(e.id)::int as total_captures
      from users u
      join entries e on e.original_contributor_id = u.id
      where e.status = 'PUBLISHED' and e.deleted_at is null
        and e.is_demo = false and u.account_kind = 'TELEGRAM' and u.is_system = false
        and u.profile_visibility = 'PUBLIC' and u.is_banned = false and u.role <> 'BANNED'
      group by u.id
    ), ranked as (
      select dense_rank() over (order by period_captures desc, total_captures desc, slug asc)::int as rank, *
      from trainer_stats where period_captures > 0
    )
    select * from ranked order by rank, slug limit $3 offset $4`,
    [period, timezone, limit, offset],
  );
  return rows.map((row) => ({
    rank: Number(row.rank),
    slug: row.slug,
    displayName: row.display_name,
    username: row.username,
    profilePhotoUrl: row.profile_photo_url,
    profileTitle: row.profile_title,
    level: row.level,
    periodCaptures: Number(row.period_captures),
    totalCaptures: Number(row.total_captures),
  }));
}

export async function getEntryRankings(
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
  const args =
    metric === "views" || metric === "likes" || metric === "rating" || metric === "recent"
      ? [period, timezone, limit, offset]
      : [period, timezone, limit, offset];
  const sql = getSqlClient();
  const rows = await sql.unsafe<
    Array<{
      rank: number;
      id: string;
      public_number: number;
      slug: string;
      name: string;
      average_rating: number;
      view_count: number;
      like_count: number;
      review_count: number;
      published_at: Date;
      category_slug: string;
      category_name: string;
      primary_image_path: string | null;
      metric_value: number;
    }>
  >(
    `with scored as (
      select e.id, e.public_number, e.slug, e.name, e.average_rating, e.view_count,
        e.like_count, e.review_count, e.published_at, c.slug category_slug, c.name category_name,
        (select object_path from entry_images i where i.entry_id=e.id and i.deleted_at is null
          order by i.is_primary desc, i.sort_order asc limit 1) primary_image_path,
        ${metricExpression} metric_value
      from entries e join categories c on c.id=e.category_id
      ${eventJoin}
      where e.status='PUBLISHED' and e.deleted_at is null ${periodFilter}
      group by e.id, c.id
    ), ranked as (
      select dense_rank() over (order by metric_value desc, published_at desc)::int rank, * from scored
      where metric_value > 0
    ) select * from ranked order by rank, published_at desc limit $3 offset $4`,
    args,
  );
  return rows.map((row) => ({
    rank: Number(row.rank),
    id: row.id,
    publicNumber: row.public_number,
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
  }));
}
