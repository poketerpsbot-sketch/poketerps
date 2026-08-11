import "server-only";

import { getSqlClient } from "@/lib/db";
import { getEnv } from "@/lib/env";

type AdminListQuery = {
  limit: number;
  offset: number;
  status?: string;
  query?: string;
  category?: string;
  subcategory?: string;
};

type CountValue = number | string;

type AdminTopTrainerRow = {
  id: string;
  public_slug: string;
  display_name: string;
  telegram_username: string | null;
  profile_photo_url: string | null;
  profile_title: string | null;
  level: number;
  experience_points: CountValue;
  capture_count: CountValue;
};

type AdminPopularEntryRow = {
  id: string;
  public_number: CountValue;
  slug: string;
  name: string;
  view_count: CountValue;
  like_count: CountValue;
  review_count: CountValue;
  average_rating: CountValue;
  published_at: string | null;
  category_slug: string;
  category_name: string;
};

type AdminDashboardRow = {
  total_users: CountValue;
  active_users: CountValue;
  new_users_30d: CountValue;
  members: CountValue;
  published_entries: CountValue;
  pending_entries: CountValue;
  captures_week: CountValue;
  captures_month: CountValue;
  total_views: CountValue;
  views_today: CountValue;
  views_30d: CountValue;
  total_likes: CountValue;
  total_reviews: CountValue;
  pending_reviews: CountValue;
  open_messages: CountValue;
  unread_messages: CountValue;
  in_progress_messages: CountValue;
  active_partners: CountValue;
  partner_clicks: CountValue;
  telegram_publications: CountValue;
  top_trainers: AdminTopTrainerRow[] | null;
  popular_entries: AdminPopularEntryRow[] | null;
};

function count(value: CountValue | null | undefined): number {
  return Number(value ?? 0);
}

export async function getAdminDashboard() {
  const timezone = getEnv().APP_TIMEZONE;
  const [row] = await getSqlClient()<AdminDashboardRow[]>`
    with settings as (
      select now() as current_time, ${timezone}::text as timezone
    ), boundaries as (
      select
        s.current_time - interval '30 days' as rolling_30d,
        date_trunc('day', s.current_time at time zone s.timezone) at time zone s.timezone as today_start,
        date_trunc('week', s.current_time at time zone s.timezone) at time zone s.timezone as week_start,
        date_trunc('month', s.current_time at time zone s.timezone) at time zone s.timezone as month_start
      from settings s
    ), user_stats as (
      select
        count(*) filter (
          where u.account_kind = 'TELEGRAM' and u.is_system = false
        )::bigint as total_users,
        count(*) filter (
          where u.account_kind = 'TELEGRAM' and u.is_system = false
            and u.is_banned = false and u.role <> 'BANNED' and u.suspended_at is null
            and u.last_seen_at >= b.rolling_30d
        )::bigint as active_users,
        count(*) filter (
          where u.account_kind = 'TELEGRAM' and u.is_system = false
            and u.created_at >= b.rolling_30d
        )::bigint as new_users_30d,
        count(*) filter (
          where u.account_kind = 'TELEGRAM' and u.is_system = false
            and u.is_banned = false and u.role <> 'BANNED' and u.suspended_at is null
        )::bigint as members
      from users u cross join boundaries b
    ), entry_stats as (
      select
        count(*) filter (
          where e.status = 'PUBLISHED' and e.deleted_at is null
        )::bigint as published_entries,
        count(*) filter (
          where e.status = 'PENDING_REVIEW' and e.deleted_at is null
        )::bigint as pending_entries,
        count(*) filter (
          where e.status = 'PUBLISHED' and e.deleted_at is null and e.is_demo = false
            and contributor.account_kind = 'TELEGRAM' and contributor.is_system = false
            and e.published_at >= b.week_start
        )::bigint as captures_week,
        count(*) filter (
          where e.status = 'PUBLISHED' and e.deleted_at is null and e.is_demo = false
            and contributor.account_kind = 'TELEGRAM' and contributor.is_system = false
            and e.published_at >= b.month_start
        )::bigint as captures_month
      from entries e
      join users contributor on contributor.id = e.original_contributor_id
      cross join boundaries b
    ), view_stats as (
      select
        count(*)::bigint as total_views,
        count(*) filter (where v.created_at >= b.today_start)::bigint as views_today,
        count(*) filter (where v.created_at >= b.rolling_30d)::bigint as views_30d
      from entry_view_events v cross join boundaries b
    ), like_stats as (
      select count(*)::bigint as total_likes from entry_likes
    ), review_stats as (
      select
        count(*) filter (where r.deleted_at is null)::bigint as total_reviews,
        count(*) filter (
          where r.status = 'PENDING_REVIEW' and r.deleted_at is null
        )::bigint as pending_reviews
      from reviews r
    ), message_stats as (
      select
        count(*) filter (
          where m.status in ('NEW', 'READ', 'IN_PROGRESS')
        )::bigint as open_messages,
        count(*) filter (where m.status = 'NEW')::bigint as unread_messages,
        count(*) filter (where m.status = 'IN_PROGRESS')::bigint as in_progress_messages
      from admin_messages m
    ), partner_stats as (
      select count(*) filter (
        where p.is_active = true and p.deleted_at is null
      )::bigint as active_partners
      from partners p
    ), partner_click_stats as (
      select count(*)::bigint as partner_clicks from partner_click_events
    ), publication_stats as (
      select count(*) filter (
        where tp.status = 'PUBLISHED' and tp.published_at is not null
      )::bigint as telegram_publications
      from telegram_publications tp
    ), top_trainers as (
      select
        u.id, u.public_slug, u.display_name, u.telegram_username,
        u.profile_photo_url, u.profile_title, u.level, u.experience_points,
        count(e.id)::bigint as capture_count
      from users u
      join entries e on e.original_contributor_id = u.id
      where e.status = 'PUBLISHED' and e.deleted_at is null and e.is_demo = false
        and u.account_kind = 'TELEGRAM' and u.is_system = false
        and u.is_banned = false and u.role <> 'BANNED' and u.suspended_at is null
        and u.profile_visibility = 'PUBLIC'
      group by u.id
      order by capture_count desc, u.public_slug asc
      limit 5
    ), popular_entries as (
      select
        e.id, e.public_number, e.slug, e.name, e.view_count, e.like_count,
        e.review_count, e.average_rating, e.published_at,
        c.slug as category_slug, c.name as category_name
      from entries e
      join users contributor on contributor.id = e.original_contributor_id
      join categories c on c.id = e.category_id
      where e.status = 'PUBLISHED' and e.deleted_at is null and e.is_demo = false
        and contributor.account_kind = 'TELEGRAM' and contributor.is_system = false
        and e.view_count > 0
      order by e.view_count desc, e.published_at desc, e.id asc
      limit 5
    )
    select
      us.*, es.*, vs.*, ls.*, rs.*, ms.*, ps.*, pcs.*, pubs.*,
      coalesce(
        (select jsonb_agg(to_jsonb(t) order by t.capture_count desc, t.public_slug asc)
          from top_trainers t),
        '[]'::jsonb
      ) as top_trainers,
      coalesce(
        (select jsonb_agg(to_jsonb(p) order by p.view_count desc, p.published_at desc, p.id asc)
          from popular_entries p),
        '[]'::jsonb
      ) as popular_entries
    from user_stats us
    cross join entry_stats es
    cross join view_stats vs
    cross join like_stats ls
    cross join review_stats rs
    cross join message_stats ms
    cross join partner_stats ps
    cross join partner_click_stats pcs
    cross join publication_stats pubs
  `;
  const topTrainers = Array.isArray(row?.top_trainers) ? row.top_trainers : [];
  const popularEntries = Array.isArray(row?.popular_entries) ? row.popular_entries : [];

  return {
    totalUsers: count(row?.total_users),
    activeUsers: count(row?.active_users),
    newUsers30d: count(row?.new_users_30d),
    members: count(row?.members),
    publishedEntries: count(row?.published_entries),
    pendingEntries: count(row?.pending_entries),
    capturesWeek: count(row?.captures_week),
    capturesMonth: count(row?.captures_month),
    totalViews: count(row?.total_views),
    viewsToday: count(row?.views_today),
    views30d: count(row?.views_30d),
    totalLikes: count(row?.total_likes),
    totalReviews: count(row?.total_reviews),
    pendingReviews: count(row?.pending_reviews),
    openMessages: count(row?.open_messages),
    unreadMessages: count(row?.unread_messages),
    inProgressMessages: count(row?.in_progress_messages),
    activePartners: count(row?.active_partners),
    partnerClicks: count(row?.partner_clicks),
    telegramPublications: count(row?.telegram_publications),
    topTrainers: topTrainers.map((trainer) => ({
      id: trainer.id,
      publicSlug: trainer.public_slug,
      slug: trainer.public_slug,
      displayName: trainer.display_name,
      telegramUsername: trainer.telegram_username,
      username: trainer.telegram_username,
      profilePhotoUrl: trainer.profile_photo_url,
      profileTitle: trainer.profile_title,
      level: Number(trainer.level),
      experiencePoints: count(trainer.experience_points),
      captureCount: count(trainer.capture_count),
      captures: count(trainer.capture_count),
    })),
    popularEntries: popularEntries.map((entry) => ({
      id: entry.id,
      publicNumber: count(entry.public_number),
      slug: entry.slug,
      name: entry.name,
      viewCount: count(entry.view_count),
      likeCount: count(entry.like_count),
      reviewCount: count(entry.review_count),
      averageRating: count(entry.average_rating),
      publishedAt: entry.published_at,
      metricValue: count(entry.view_count),
      category: { slug: entry.category_slug, name: entry.category_name },
    })),
  };
}

export async function listAdminEntries(query: AdminListQuery) {
  const status = query.status ?? null;
  const search = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : null;
  const rows = await getSqlClient()<
    Array<{
      id: string;
      public_number: number;
      slug: string;
      name: string;
      status: string;
      rarity: string;
      short_description: string | null;
      category_id: string;
      category_name: string;
      category_slug: string;
      subcategory_id: string | null;
      subcategory_name: string | null;
      subcategory_slug: string | null;
      author_id: string;
      author_name: string;
      author_username: string | null;
      created_at: Date;
      updated_at: Date;
      submitted_at: Date | null;
      total_count: number;
    }>
  >`
    select e.id, e.public_number, e.slug, e.name, e.short_description,
      e.status::text, e.rarity::text,
      c.id category_id, c.name category_name, c.slug category_slug,
      sc.id subcategory_id, sc.name subcategory_name, sc.slug subcategory_slug,
      u.id as author_id, u.display_name as author_name, u.telegram_username as author_username,
      e.created_at, e.updated_at,
      (select max(s.submitted_at) from submissions s where s.entry_id = e.id) as submitted_at,
      count(*) over()::int as total_count
    from entries e
    join users u on u.id = e.original_contributor_id
    join categories c on c.id=e.category_id
    left join subcategories sc on sc.id=e.subcategory_id
    where e.deleted_at is null
      and (${status}::text is null or e.status::text = ${status})
      and (${query.category ?? null}::text is null
        or c.id::text=${query.category ?? null} or c.slug=${query.category ?? null})
      and (${query.subcategory ?? null}::text is null
        or sc.id::text=${query.subcategory ?? null} or sc.slug=${query.subcategory ?? null})
      and (${search}::text is null
        or e.name ilike ${search}
        or e.public_number::text ilike ${search}
        or u.display_name ilike ${search}
        or u.telegram_username ilike ${search}
        or c.name ilike ${search}
        or sc.name ilike ${search})
    order by
      case when e.status = 'PENDING_REVIEW' then 0 else 1 end,
      e.updated_at asc
    limit ${query.limit} offset ${query.offset}
  `;
  return {
    entries: rows.map((row) => ({
      id: row.id,
      publicNumber: row.public_number,
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description,
      status: row.status,
      rarity: row.rarity,
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
      },
      subcategory: row.subcategory_id
        ? {
            id: row.subcategory_id,
            name: row.subcategory_name ?? "Sous-catégorie",
            slug: row.subcategory_slug ?? undefined,
          }
        : null,
      author: {
        id: row.author_id,
        displayName: row.author_name,
        username: row.author_username,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
  };
}

export async function listAdminReviews(query: AdminListQuery) {
  const status = query.status ?? null;
  const search = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : null;
  const rows = await getSqlClient()<
    Array<{
      id: string;
      entry_id: string;
      entry_name: string;
      content: string;
      overall_rating: number;
      status: string;
      moderation_reason: string | null;
      user_id: string;
      author_name: string;
      author_username: string | null;
      created_at: Date;
      updated_at: Date;
      moderation_history: Array<{
        id: string;
        action: string;
        previousStatus: string | null;
        newStatus: string | null;
        message: string | null;
        createdAt: string;
        resolvedAt: string | null;
        admin: { id: string; displayName: string; username: string | null } | null;
        user: { id: string; displayName: string; username: string | null } | null;
      }>;
      total_count: number;
    }>
  >`
    select r.id, r.entry_id, e.name as entry_name, r.content, r.overall_rating,
      r.status::text, r.moderation_reason, r.user_id,
      r.author_display_name_snapshot as author_name,
      r.author_username_snapshot as author_username, r.created_at, r.updated_at,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', event.id,
          'action', event.action::text,
          'previousStatus', event.previous_status::text,
          'newStatus', event.new_status::text,
          'message', event.message,
          'createdAt', event.created_at,
          'resolvedAt', event.resolved_at,
          'admin', case when admin.id is null then null else jsonb_build_object(
            'id', admin.id, 'displayName', admin.display_name,
            'username', admin.telegram_username
          ) end,
          'user', case when author.id is null then null else jsonb_build_object(
            'id', author.id, 'displayName', author.display_name,
            'username', author.telegram_username
          ) end
        ) order by event.created_at desc), '[]'::jsonb)
        from review_moderation_events event
        left join users admin on admin.id=event.admin_id
        left join users author on author.id=event.user_id
        where event.review_id=r.id
      ) moderation_history,
      count(*) over()::int as total_count
    from reviews r
    join entries e on e.id = r.entry_id
    where r.deleted_at is null
      and (${status}::text is null or r.status::text = ${status})
      and (${search}::text is null or r.content ilike ${search} or e.name ilike ${search}
        or coalesce(r.author_display_name_snapshot, '') ilike ${search})
    order by
      case when ${status}::text is null then 0 when r.status = 'PENDING_REVIEW' then 0 else 1 end,
      case when ${status}::text is null then r.updated_at end desc,
      case when ${status}::text is not null then r.created_at end asc
    limit ${query.limit} offset ${query.offset}
  `;
  return {
    reviews: rows.map((row) => ({
      id: row.id,
      entryId: row.entry_id,
      entryName: row.entry_name,
      content: row.content,
      overallRating: Number(row.overall_rating),
      status: row.status,
      moderationReason: row.moderation_reason,
      author: {
        id: row.user_id,
        displayName: row.author_name,
        username: row.author_username,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      moderationHistory: Array.isArray(row.moderation_history) ? row.moderation_history : [],
    })),
    total: Number(rows[0]?.total_count ?? 0),
  };
}
