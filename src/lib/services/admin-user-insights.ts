import "server-only";

import { createHash } from "node:crypto";

import type { CurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { hasUserPermission, resolvedTeamPermissions } from "@/lib/auth/team-permissions";
import { getSqlClient } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { assertCanManageUser, canManageUser } from "@/lib/services/admin-users";
import { recordAudit } from "@/lib/services/audit";
import { escapeTelegramHtml, sendTelegramMessage } from "@/lib/services/telegram-client";
import type { updateUserTeamPermissionSchema } from "@/lib/validation/admin-management";
import type { z } from "zod";

type CountValue = number | string;

function count(value: CountValue | null | undefined) {
  return Number(value ?? 0);
}

async function getUserRankings(userId: string) {
  const timezone = getEnv().APP_TIMEZONE;
  const [row] = await getSqlClient()<
    Array<{
      weekly_rank: CountValue | null;
      monthly_rank: CountValue | null;
      general_rank: CountValue | null;
      captures_rank: CountValue | null;
    }>
  >`
    with boundaries as (
      select
        date_trunc('week',now() at time zone ${timezone}) at time zone ${timezone} week_start,
        date_trunc('month',now() at time zone ${timezone}) at time zone ${timezone} month_start
    ), eligible_users as (
      select u.id from users u where u.account_kind='TELEGRAM' and not u.is_system
        and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED'
    ), eligible_entries as (
      select e.id,e.original_contributor_id,e.published_at
      from entries e join eligible_users u on u.id=e.original_contributor_id
      where e.status='PUBLISHED' and e.deleted_at is null and not e.is_demo
    ), capture_stats as (
      select u.id user_id,
        count(e.id) filter(where e.published_at>=b.week_start)::int weekly_captures,
        count(e.id) filter(where e.published_at>=b.month_start)::int monthly_captures,
        count(e.id)::int total_captures
      from eligible_users u cross join boundaries b
      left join eligible_entries e on e.original_contributor_id=u.id
      group by u.id
    ), like_stats as (
      select e.original_contributor_id user_id,
        count(l.id) filter(where l.created_at>=b.week_start)::int weekly_likes,
        count(l.id) filter(where l.created_at>=b.month_start)::int monthly_likes,
        count(l.id)::int total_likes
      from eligible_entries e cross join boundaries b
      left join entry_likes l on l.entry_id=e.id
      group by e.original_contributor_id
    ), view_stats as (
      select e.original_contributor_id user_id,
        count(v.id) filter(where v.created_at>=b.week_start)::int weekly_views,
        count(v.id) filter(where v.created_at>=b.month_start)::int monthly_views,
        count(v.id)::int total_views
      from eligible_entries e cross join boundaries b
      left join entry_view_events v on v.entry_id=e.id
      group by e.original_contributor_id
    ), scores as (
      select c.user_id,c.weekly_captures,c.monthly_captures,c.total_captures,
        coalesce(l.weekly_likes,0) weekly_likes,
        coalesce(l.monthly_likes,0) monthly_likes,coalesce(l.total_likes,0) total_likes,
        coalesce(v.weekly_views,0) weekly_views,
        coalesce(v.monthly_views,0) monthly_views,coalesce(v.total_views,0) total_views
      from capture_stats c left join like_stats l on l.user_id=c.user_id
      left join view_stats v on v.user_id=c.user_id
    ), ranked as (
      select *,
        dense_rank() over(order by weekly_captures desc,weekly_likes desc,
          weekly_views desc,total_captures desc)::int weekly_rank,
        dense_rank() over(order by monthly_captures desc,monthly_likes desc,
          monthly_views desc,total_captures desc)::int monthly_rank,
        dense_rank() over(order by total_captures desc,total_likes desc,total_views desc)::int general_rank,
        dense_rank() over(order by total_captures desc)::int captures_rank
      from scores
    )
    select
      case when weekly_captures>0 then weekly_rank end weekly_rank,
      case when monthly_captures>0 then monthly_rank end monthly_rank,
      case when total_captures>0 then general_rank end general_rank,
      case when total_captures>0 then captures_rank end captures_rank
    from ranked where user_id=${userId}::uuid
  `;
  return {
    weekly:
      row?.weekly_rank === null || row?.weekly_rank === undefined ? null : count(row.weekly_rank),
    monthly:
      row?.monthly_rank === null || row?.monthly_rank === undefined
        ? null
        : count(row.monthly_rank),
    general:
      row?.general_rank === null || row?.general_rank === undefined
        ? null
        : count(row.general_rank),
    captures:
      row?.captures_rank === null || row?.captures_rank === undefined
        ? null
        : count(row.captures_rank),
  };
}

export async function getAdminUserDetail(userId: string, actor: CurrentUser) {
  const sql = getSqlClient();
  const env = getEnv();
  const [
    [user],
    [stats],
    sessions,
    activity,
    notes,
    roleHistory,
    sanctions,
    telegramMessages,
    teamPermissions,
  ] = await Promise.all([
    sql<
      Array<{
        id: string;
        display_name: string;
        public_slug: string;
        telegram_username: string | null;
        telegram_id: CountValue | null;
        profile_photo_url: string | null;
        role: UserRole;
        role_before_ban: UserRole | null;
        is_system: boolean;
        is_banned: boolean;
        suspended_at: string | null;
        suspension_reason: string | null;
        banned_until: string | null;
        created_at: string;
        appointed_at: string;
        last_seen_at: string | null;
        level: number;
        experience_points: CountValue;
      }>
    >`
      select id,display_name,public_slug,telegram_username,telegram_id,profile_photo_url,
        role::text,role_before_ban::text,is_system,is_banned,suspended_at,suspension_reason,banned_until,
        created_at,coalesce((select h.created_at from role_history h
          where h.user_id=users.id and h.new_role=users.role
          order by h.created_at desc limit 1),created_at) appointed_at,
        last_seen_at,level,experience_points
      from users where id=${userId}::uuid limit 1
    `,
    sql<
      Array<{
        sessions_7d: CountValue;
        sessions_30d: CountValue;
        sessions_total: CountValue;
        session_duration_total: CountValue;
        session_duration_average: CountValue;
        session_platforms: Array<{
          platform: string;
          sessions: CountValue;
          durationSeconds: CountValue;
        }>;
        active_days_7d: CountValue;
        active_days_30d: CountValue;
        actions_7d: CountValue;
        actions_30d: CountValue;
        entries_created: CountValue;
        entries_submitted: CountValue;
        entries_approved: CountValue;
        entries_rejected: CountValue;
        reviews_submitted: CountValue;
        reviews_approved: CountValue;
        reviews_rejected: CountValue;
        likes_given: CountValue;
        likes_received: CountValue;
        favorites_saved: CountValue;
        favorites_received: CountValue;
        views_received: CountValue;
        messages_sent: CountValue;
        reports_sent: CountValue;
        contest_participations: CountValue;
        entries_moderated: CountValue;
        reviews_moderated: CountValue;
        contests_moderated: CountValue;
        telegram_messages_sent: CountValue;
        entry_approvals_30d: CountValue;
        entry_rejections_30d: CountValue;
        review_approvals_30d: CountValue;
        review_rejections_30d: CountValue;
        contest_decisions_30d: CountValue;
        sanctions_30d: CountValue;
      }>
    >`
      select
        (select count(*) from user_sessions s
          where s.user_id=${userId}::uuid and s.started_at>=now()-interval '7 days') sessions_7d,
        (select count(*) from user_sessions s
          where s.user_id=${userId}::uuid and s.started_at>=now()-interval '30 days') sessions_30d,
        (select count(*) from user_sessions s where s.user_id=${userId}::uuid) sessions_total,
        (select coalesce(sum(s.duration_seconds),0) from user_sessions s
          where s.user_id=${userId}::uuid and s.duration_seconds between 0
            and ${env.SESSION_MAX_DURATION_SECONDS}) session_duration_total,
        (select coalesce(round(avg(s.duration_seconds)),0) from user_sessions s
          where s.user_id=${userId}::uuid and s.duration_seconds between 0
            and ${env.SESSION_MAX_DURATION_SECONDS}) session_duration_average,
        (select coalesce(jsonb_agg(jsonb_build_object(
          'platform',platform,'sessions',sessions,'durationSeconds',duration_seconds
        ) order by sessions desc),'[]'::jsonb) from (
          select s.platform::text platform,count(*)::int sessions,
            coalesce(sum(coalesce(s.duration_seconds,0)),0)::bigint duration_seconds
          from user_sessions s where s.user_id=${userId}::uuid
            and s.duration_seconds between 0 and ${env.SESSION_MAX_DURATION_SECONDS}
          group by s.platform
        ) platform_totals) session_platforms,
        (select count(distinct (s.last_activity_at at time zone ${env.APP_TIMEZONE})::date)
          from user_sessions s where s.user_id=${userId}::uuid
            and s.last_activity_at>=now()-interval '7 days') active_days_7d,
        (select count(distinct (s.last_activity_at at time zone ${env.APP_TIMEZONE})::date)
          from user_sessions s where s.user_id=${userId}::uuid
            and s.last_activity_at>=now()-interval '30 days') active_days_30d,
        (select count(*) from user_activity_events e
          where e.user_id=${userId}::uuid and e.created_at>=now()-interval '7 days') actions_7d,
        (select count(*) from user_activity_events e
          where e.user_id=${userId}::uuid and e.created_at>=now()-interval '30 days') actions_30d,
        (select count(*) from entries e where e.original_contributor_id=${userId}::uuid
          and e.deleted_at is null) entries_created,
        (select count(*) from entries e where e.original_contributor_id=${userId}::uuid
          and e.status not in ('DRAFT','DELETED')) entries_submitted,
        (select count(*) from entries e where e.original_contributor_id=${userId}::uuid
          and e.status in ('APPROVED','PUBLISHED','HIDDEN','ARCHIVED')) entries_approved,
        (select count(*) from entries e where e.original_contributor_id=${userId}::uuid
          and e.status='REJECTED') entries_rejected,
        (select count(*) from reviews r where r.user_id=${userId}::uuid
          and r.status not in ('DRAFT','DELETED')) reviews_submitted,
        (select count(*) from reviews r where r.user_id=${userId}::uuid
          and r.status in ('APPROVED','PUBLISHED','HIDDEN')) reviews_approved,
        (select count(*) from reviews r where r.user_id=${userId}::uuid
          and r.status='REJECTED') reviews_rejected,
        (select count(*) from entry_likes l where l.user_id=${userId}::uuid) likes_given,
        (select coalesce(sum(e.like_count),0) from entries e
          where e.original_contributor_id=${userId}::uuid and e.deleted_at is null) likes_received,
        (select count(*) from favorites f where f.user_id=${userId}::uuid) favorites_saved,
        (select coalesce(sum(e.favorite_count),0) from entries e
          where e.original_contributor_id=${userId}::uuid and e.deleted_at is null) favorites_received,
        (select coalesce(sum(e.view_count),0) from entries e
          where e.original_contributor_id=${userId}::uuid and e.deleted_at is null) views_received,
        (select count(*) from admin_messages m where m.user_id=${userId}::uuid) messages_sent,
        (select count(*) from reports r where r.reporter_user_id=${userId}::uuid) reports_sent,
        (select count(*) from contest_participations p
          where p.user_id=${userId}::uuid) contest_participations,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.action like 'ENTRY_%') entries_moderated,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.action like 'REVIEW_%') reviews_moderated,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.action like 'CONTEST_%') contests_moderated,
        (select count(*) from admin_outbound_messages m where m.admin_id=${userId}::uuid
          and m.status='SENT') telegram_messages_sent,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.created_at>=now()-interval '30 days'
          and a.action in ('ENTRY_APPROVED','ENTRY_PUBLISHED')) entry_approvals_30d,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.created_at>=now()-interval '30 days'
          and a.action='ENTRY_REJECTED') entry_rejections_30d,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.created_at>=now()-interval '30 days'
          and a.action in ('REVIEW_APPROVED','REVIEW_PUBLISHED')) review_approvals_30d,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.created_at>=now()-interval '30 days'
          and a.action='REVIEW_REJECTED') review_rejections_30d,
        (select count(*) from audit_logs a where a.actor_user_id=${userId}::uuid
          and a.created_at>=now()-interval '30 days'
          and a.action='CONTEST_PARTICIPATION_MODERATED') contest_decisions_30d,
        (select count(*) from user_moderation_events e where e.admin_id=${userId}::uuid
          and e.created_at>=now()-interval '30 days') sanctions_30d
    `,
    sql<
      Array<{
        id: string;
        platform: string;
        started_at: string;
        ended_at: string | null;
        last_activity_at: string;
        duration_seconds: number;
        app_version: string | null;
        action_count: CountValue;
      }>
    >`
      select s.id,s.platform::text,s.started_at,
        coalesce(s.ended_at,case when s.last_activity_at<now()-make_interval(
          secs=>${env.SESSION_INACTIVITY_SECONDS}::int) then s.last_activity_at end) ended_at,
        s.last_activity_at,
        least(${env.SESSION_MAX_DURATION_SECONDS}::int,greatest(0,
          extract(epoch from (coalesce(s.ended_at,s.last_activity_at)-s.started_at))::int
        )) duration_seconds,s.app_version,
        (select count(*) from user_activity_events e where e.session_id=s.id) action_count
      from user_sessions s where s.user_id=${userId}::uuid
      order by started_at desc limit 50
    `,
    sql<
      Array<{
        id: string;
        event_type: string;
        entity_type: string | null;
        entity_id: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
      }>
    >`
      select id,event_type::text,entity_type,entity_id,metadata,created_at
      from user_activity_events where user_id=${userId}::uuid
      order by created_at desc limit 100
    `,
    sql<
      Array<{
        id: string;
        content: string;
        admin_id: string;
        admin_name: string | null;
        created_at: string;
        updated_at: string;
      }>
    >`
      select n.id,n.content,n.admin_id,a.display_name admin_name,n.created_at,n.updated_at
      from admin_user_notes n left join users a on a.id=n.admin_id
      where n.user_id=${userId}::uuid order by n.created_at desc limit 100
    `,
    sql<
      Array<{
        id: string;
        previous_role: string | null;
        new_role: string;
        reason: string | null;
        changed_by_id: string | null;
        changed_by_name: string | null;
        created_at: string;
      }>
    >`
      select h.id,h.previous_role::text,h.new_role::text,h.reason,h.changed_by_id,
        a.display_name changed_by_name,h.created_at
      from role_history h left join users a on a.id=h.changed_by_id
      where h.user_id=${userId}::uuid order by h.created_at desc limit 100
    `,
    sql<
      Array<{
        id: string;
        action: string;
        reason: string;
        starts_at: string;
        ends_at: string | null;
        admin_id: string;
        admin_name: string | null;
        previous_role: string | null;
        created_at: string;
      }>
    >`
      select e.id,e.action::text,e.reason,e.starts_at,e.ends_at,e.admin_id,
        a.display_name admin_name,e.previous_role::text,e.created_at
      from user_moderation_events e left join users a on a.id=e.admin_id
      where e.user_id=${userId}::uuid order by e.created_at desc limit 100
    `,
    sql<
      Array<{
        id: string;
        content: string;
        status: string;
        telegram_message_id: CountValue | null;
        error_message: string | null;
        admin_id: string;
        admin_name: string | null;
        created_at: string;
        sent_at: string | null;
      }>
    >`
      select m.id,m.content,m.status::text,m.telegram_message_id,m.error_message,
        m.admin_id,a.display_name admin_name,m.created_at,m.sent_at
      from admin_outbound_messages m left join users a on a.id=m.admin_id
      where m.user_id=${userId}::uuid order by m.created_at desc limit 100
    `,
    sql<
      Array<{
        permission_code: string;
        is_granted: boolean | null;
        expires_at: string | null;
        effective: boolean;
      }>
    >`
      with required(permission_code) as (values
        ('VIEW_ADMIN_ACTIVITY'::text),
        ('VIEW_MODERATOR_ACTIVITY'::text),
        ('VIEW_TEAM_AUDIT_LOG'::text)
      )
      select r.permission_code,p.is_granted,p.expires_at,
        public.user_has_permission(${userId}::uuid,r.permission_code) effective
      from required r left join user_permissions p
        on p.user_id=${userId}::uuid and p.permission_code=r.permission_code
      order by r.permission_code
    `,
  ]);
  if (!user) throw notFound("Utilisateur");
  const protectedRole = user.role === "BANNED" ? user.role_before_ban : user.role;
  if (
    (protectedRole === "OWNER" || protectedRole === "ADMIN") &&
    !(await hasUserPermission(actor, "VIEW_ADMIN_ACTIVITY"))
  ) {
    throw forbidden("Activité administrateur inaccessible.");
  }
  if (
    protectedRole === "MODERATOR" &&
    !(await hasUserPermission(actor, "VIEW_MODERATOR_ACTIVITY"))
  ) {
    throw forbidden("Activité de modération inaccessible.");
  }
  if (
    protectedRole !== "OWNER" &&
    protectedRole !== "ADMIN" &&
    protectedRole !== "MODERATOR" &&
    !hasPermission(actor.role, "user:manage")
  ) {
    throw forbidden("Dossier utilisateur inaccessible.");
  }
  const canManageAccount = canManageUser(actor, {
    id: user.id,
    role: protectedRole ?? user.role,
    isSystem: user.is_system,
  });
  const rankings = await getUserRankings(userId);
  return {
    user: {
      id: user.id,
      displayName: user.display_name,
      publicSlug: user.public_slug,
      telegramUsername: user.telegram_username,
      ...(actor.role === "OWNER"
        ? { telegramId: user.telegram_id === null ? null : Number(user.telegram_id) }
        : {}),
      profilePhotoUrl: user.profile_photo_url,
      role: user.role,
      isSystem: user.is_system,
      isBanned: user.is_banned,
      suspendedAt: user.suspended_at,
      suspensionReason: user.suspension_reason,
      suspensionUntil: user.banned_until,
      createdAt: user.created_at,
      firstInteractionAt: user.created_at,
      appointedAt: user.appointed_at,
      lastSeenAt: user.last_seen_at,
      level: user.level,
      experiencePoints: count(user.experience_points),
    },
    stats: {
      sessions7d: count(stats?.sessions_7d),
      sessions30d: count(stats?.sessions_30d),
      sessionsTotal: count(stats?.sessions_total),
      sessionDurationTotalSeconds: count(stats?.session_duration_total),
      sessionDurationAverageSeconds: count(stats?.session_duration_average),
      sessionPlatforms: (stats?.session_platforms ?? []).map((platform) => ({
        platform: platform.platform,
        sessions: count(platform.sessions),
        durationSeconds: count(platform.durationSeconds),
      })),
      activeDays7d: count(stats?.active_days_7d),
      activeDays30d: count(stats?.active_days_30d),
      actions7d: count(stats?.actions_7d),
      actions30d: count(stats?.actions_30d),
      entriesCreated: count(stats?.entries_created),
      entriesSubmitted: count(stats?.entries_submitted),
      entriesApproved: count(stats?.entries_approved),
      entriesRejected: count(stats?.entries_rejected),
      reviewsSubmitted: count(stats?.reviews_submitted),
      reviewsApproved: count(stats?.reviews_approved),
      reviewsRejected: count(stats?.reviews_rejected),
      likesGiven: count(stats?.likes_given),
      likesReceived: count(stats?.likes_received),
      favoritesSaved: count(stats?.favorites_saved),
      favoritesReceived: count(stats?.favorites_received),
      viewsReceived: count(stats?.views_received),
      messagesSent: count(stats?.messages_sent),
      reportsSent: count(stats?.reports_sent),
      contestParticipations: count(stats?.contest_participations),
      entriesModerated: count(stats?.entries_moderated),
      reviewsModerated: count(stats?.reviews_moderated),
      contestsModerated: count(stats?.contests_moderated),
      telegramMessagesSent: count(stats?.telegram_messages_sent),
      entryApprovals30d: count(stats?.entry_approvals_30d),
      entryRejections30d: count(stats?.entry_rejections_30d),
      reviewApprovals30d: count(stats?.review_approvals_30d),
      reviewRejections30d: count(stats?.review_rejections_30d),
      contestDecisions30d: count(stats?.contest_decisions_30d),
      sanctions30d: count(stats?.sanctions_30d),
    },
    rankings,
    sessions: sessions.map((row) => ({
      id: row.id,
      platform: row.platform,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      lastActivityAt: row.last_activity_at,
      durationSeconds: Number(row.duration_seconds),
      actionCount: count(row.action_count),
      appVersion: row.app_version,
    })),
    activity: activity.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    })),
    notes: notes.map((row) => ({
      id: row.id,
      content: row.content,
      adminId: row.admin_id,
      adminName: row.admin_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    roleHistory: roleHistory.map((row) => ({
      id: row.id,
      previousRole: row.previous_role,
      newRole: row.new_role,
      reason: row.reason,
      changedById: row.changed_by_id,
      changedByName: row.changed_by_name,
      createdAt: row.created_at,
    })),
    sanctions: sanctions.map((row) => ({
      id: row.id,
      action: row.action,
      reason: row.reason,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      adminId: row.admin_id,
      adminName: row.admin_name,
      previousRole: row.previous_role,
      createdAt: row.created_at,
    })),
    telegramMessages: telegramMessages.map((row) => ({
      id: row.id,
      text: row.content,
      status: row.status,
      telegramMessageId: row.telegram_message_id === null ? null : Number(row.telegram_message_id),
      errorMessage: row.error_message,
      adminId: row.admin_id,
      adminName: row.admin_name,
      createdAt: row.created_at,
      sentAt: row.sent_at,
    })),
    canManageAccount,
    canManageTeamPermissions:
      actor.role === "OWNER" && (protectedRole === "ADMIN" || protectedRole === "MODERATOR"),
    teamPermissions: teamPermissions.map((row) => ({
      permissionCode: row.permission_code,
      override: row.is_granted,
      effective: row.effective,
      expiresAt: row.expires_at,
    })),
  };
}

export async function updateUserTeamPermission(
  userId: string,
  input: z.infer<typeof updateUserTeamPermissionSchema>,
  actor: CurrentUser,
  requestId?: string,
) {
  if (actor.role !== "OWNER") throw forbidden("Seul le propriétaire peut déléguer cet accès.");
  const sql = getSqlClient();
  const [target] = await sql<
    Array<{ role: UserRole; role_before_ban: UserRole | null; is_system: boolean }>
  >`
    select role::text,role_before_ban::text,is_system
    from users where id=${userId}::uuid limit 1
  `;
  if (!target) throw notFound("Utilisateur");
  const protectedRole = target.role === "BANNED" ? target.role_before_ban : target.role;
  if (target.is_system || !protectedRole || !["ADMIN", "MODERATOR"].includes(protectedRole)) {
    throw conflict(
      "Ces permissions sont réservées aux administrateurs et modérateurs.",
      "TEAM_PERMISSION_TARGET_INVALID",
    );
  }
  const [before] = await sql<Array<{ is_granted: boolean; expires_at: string | null }>>`
    select is_granted,expires_at from user_permissions
    where user_id=${userId}::uuid and permission_code=${input.permissionCode}
  `;
  if (input.isGranted === null) {
    await sql`
      delete from user_permissions
      where user_id=${userId}::uuid and permission_code=${input.permissionCode}
    `;
  } else {
    await sql`
      insert into user_permissions(
        user_id,permission_code,is_granted,granted_by_id,expires_at
      ) values (
        ${userId}::uuid,${input.permissionCode},${input.isGranted},${actor.id}::uuid,
        ${input.expiresAt ?? null}::timestamptz
      )
      on conflict(user_id,permission_code) do update set
        is_granted=excluded.is_granted,granted_by_id=excluded.granted_by_id,
        expires_at=excluded.expires_at,updated_at=now()
    `;
  }
  const [effective] = await sql<Array<{ value: boolean }>>`
    select public.user_has_permission(${userId}::uuid,${input.permissionCode}) value
  `;
  await recordAudit({
    actorUserId: actor.id,
    actorTelegramIdSnapshot: actor.telegramId,
    actorRole: actor.role,
    action: "USER_TEAM_PERMISSION_UPDATED",
    entityType: "USER",
    entityId: userId,
    source: "WEB_ADMIN",
    requestId,
    before: before
      ? { isGranted: before.is_granted, expiresAt: before.expires_at }
      : { inherited: true },
    after:
      input.isGranted === null
        ? { inherited: true }
        : { isGranted: input.isGranted, expiresAt: input.expiresAt ?? null },
    metadata: { permissionCode: input.permissionCode },
  });
  return {
    permissionCode: input.permissionCode,
    override: input.isGranted,
    effective: Boolean(effective?.value),
    expiresAt: input.isGranted === null ? null : (input.expiresAt ?? null),
  };
}

export async function addAdminUserNote(
  userId: string,
  content: string,
  actor: CurrentUser,
  requestId?: string,
) {
  const [target] = await getSqlClient()<
    Array<{ id: string; role: UserRole; role_before_ban: UserRole | null; is_system: boolean }>
  >`
    select id,role::text,role_before_ban::text,is_system
    from users where id=${userId}::uuid limit 1
  `;
  if (!target) throw notFound("Utilisateur");
  assertCanManageUser(actor, {
    id: target.id,
    role: target.role === "BANNED" ? (target.role_before_ban ?? target.role) : target.role,
    isSystem: target.is_system,
  });
  const [note] = await getSqlClient()<
    Array<{ id: string; content: string; created_at: string; updated_at: string }>
  >`
    insert into admin_user_notes(user_id,admin_id,content)
    select u.id,${actor.id}::uuid,${content}
    from users u where u.id=${userId}::uuid and not u.is_system
    returning id,content,created_at,updated_at
  `;
  if (!note) throw notFound("Utilisateur");
  await recordAudit({
    actorUserId: actor.id,
    actorTelegramIdSnapshot: actor.telegramId,
    actorRole: actor.role,
    action: "USER_INTERNAL_NOTE_ADDED",
    entityType: "USER",
    entityId: userId,
    source: "WEB_ADMIN",
    requestId,
    metadata: { noteId: note.id },
  });
  return {
    id: note.id,
    content: note.content,
    adminId: actor.id,
    adminName: actor.displayName,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}

export async function sendAdminUserTelegramMessage(
  userId: string,
  content: string,
  actor: CurrentUser,
  requestId: string,
) {
  const sql = getSqlClient();
  const [target] = await sql<
    Array<{
      id: string;
      telegram_id: CountValue | null;
      is_system: boolean;
      is_banned: boolean;
      role: UserRole;
      role_before_ban: UserRole | null;
    }>
  >`
    select id,telegram_id,is_system,is_banned,role::text,role_before_ban::text
    from users where id=${userId}::uuid limit 1
  `;
  if (!target) throw notFound("Utilisateur");
  assertCanManageUser(actor, {
    id: target.id,
    role: target.role === "BANNED" ? (target.role_before_ban ?? target.role) : target.role,
    isSystem: target.is_system,
  });
  if (target.is_system || target.telegram_id === null) {
    throw conflict(
      "Ce compte ne peut pas recevoir de message Telegram.",
      "TELEGRAM_USER_UNAVAILABLE",
    );
  }
  const contentFingerprint = createHash("sha256").update(content).digest("hex").slice(0, 24);
  const idempotencyKey = `user-message:${actor.id}:${userId}:${contentFingerprint}:${requestId}`;
  const [outbound] = await sql<
    Array<{ id: string; status: string; telegram_message_id: CountValue | null }>
  >`
    insert into admin_outbound_messages(
      user_id,admin_id,content,status,idempotency_key
    ) values (
      ${userId}::uuid,${actor.id}::uuid,${content},'QUEUED'::admin_outbound_message_status,
      ${idempotencyKey}
    )
    on conflict (idempotency_key) do update set idempotency_key=excluded.idempotency_key
    returning id,status::text,telegram_message_id
  `;
  if (!outbound) throw new Error("Outbound message insert failed");
  if (outbound.status === "SENT") {
    return {
      id: outbound.id,
      status: "SENT" as const,
      telegramMessageId:
        outbound.telegram_message_id === null ? null : Number(outbound.telegram_message_id),
    };
  }
  try {
    const message = await sendTelegramMessage(
      Number(target.telegram_id),
      escapeTelegramHtml(content),
    );
    const [sent] = await sql<
      Array<{ id: string; status: string; telegram_message_id: CountValue; sent_at: string }>
    >`
      update admin_outbound_messages set status='SENT',telegram_message_id=${message.message_id},
        sent_at=now(),error_message=null where id=${outbound.id}::uuid
      returning id,status::text,telegram_message_id,sent_at
    `;
    await recordAudit({
      actorUserId: actor.id,
      actorTelegramIdSnapshot: actor.telegramId,
      actorRole: actor.role,
      action: "USER_TELEGRAM_MESSAGE_SENT",
      entityType: "USER",
      entityId: userId,
      source: "WEB_ADMIN",
      requestId,
      metadata: { outboundMessageId: outbound.id },
    });
    return {
      id: sent?.id ?? outbound.id,
      status: "SENT" as const,
      telegramMessageId: Number(sent?.telegram_message_id ?? message.message_id),
      sentAt: sent?.sent_at ?? new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "Échec Telegram";
    await sql`
      update admin_outbound_messages set status='FAILED',error_message=${message}
      where id=${outbound.id}::uuid
    `;
    throw error;
  }
}

export async function getTeamActivity(
  input: {
    days: number;
    scope: "all" | "admins" | "moderators";
    userId?: string;
    includeOwner?: boolean;
  },
  actor: CurrentUser,
) {
  const timezone = getEnv().APP_TIMEZONE;
  const permissions = await resolvedTeamPermissions(actor);
  const canAdmins = permissions.VIEW_ADMIN_ACTIVITY;
  const canModerators = permissions.VIEW_MODERATOR_ACTIVITY;
  if (!canAdmins && !canModerators) throw forbidden("Activité d’équipe inaccessible.");
  if (input.scope === "admins" && !canAdmins)
    throw forbidden("Activité administrateur inaccessible.");
  if (input.scope === "moderators" && !canModerators)
    throw forbidden("Activité de modération inaccessible.");
  const roles: string[] = [];
  const includeOwner = actor.role === "OWNER" && input.includeOwner === true;
  if (input.scope !== "moderators" && canAdmins) {
    roles.push("ADMIN");
    if (includeOwner) roles.push("OWNER");
  }
  if (input.scope !== "admins" && canModerators) roles.push("MODERATOR");
  const sql = getSqlClient();
  const members = await sql.unsafe<
    Array<{
      id: string;
      display_name: string;
      public_slug: string;
      telegram_username: string | null;
      profile_photo_url: string | null;
      role: string;
      appointed_at: string;
      last_seen_at: string | null;
      is_active_7d: boolean;
      sessions_7d: CountValue;
      active_days_7d: CountValue;
      actions_7d: CountValue;
      duration_seconds_period: CountValue;
      sessions_30d: CountValue;
      active_days_30d: CountValue;
      actions_30d: CountValue;
      entries_moderated_7d: CountValue;
      reviews_moderated_7d: CountValue;
      messages_handled_7d: CountValue;
      contest_actions_7d: CountValue;
      telegram_messages_sent_7d: CountValue;
      entry_approvals_period: CountValue;
      entry_rejections_period: CountValue;
      review_approvals_period: CountValue;
      review_rejections_period: CountValue;
      contest_decisions_period: CountValue;
      sanctions_period: CountValue;
    }>
  >(
    `select u.id,u.display_name,u.public_slug,u.telegram_username,u.profile_photo_url,
      u.role::text,coalesce((select h.created_at from role_history h
        where h.user_id=u.id and h.new_role=u.role order by h.created_at desc limit 1),
        u.created_at) appointed_at,u.last_seen_at,
      (exists(select 1 from user_sessions s where s.user_id=u.id
        and s.last_activity_at>=now()-interval '7 days') or
       exists(select 1 from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-interval '7 days')) is_active_7d,
      (select count(*) from user_sessions s where s.user_id=u.id
        and s.started_at>=now()-($1::int*interval '1 day')) sessions_7d,
      (select count(distinct (s.last_activity_at at time zone $7::text)::date)
        from user_sessions s where s.user_id=u.id
        and s.last_activity_at>=now()-($1::int*interval '1 day')) active_days_7d,
      (select coalesce(sum(s.duration_seconds),0) from user_sessions s where s.user_id=u.id
        and s.started_at>=now()-($1::int*interval '1 day')
        and s.duration_seconds between 0 and $6::int) duration_seconds_period,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day')) actions_7d,
      (select count(*) from user_sessions s where s.user_id=u.id
        and s.started_at>=now()-interval '30 days') sessions_30d,
      (select count(distinct (s.last_activity_at at time zone 'UTC')::date)
        from user_sessions s where s.user_id=u.id
        and s.last_activity_at>=now()-interval '30 days') active_days_30d,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-interval '30 days') actions_30d,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day') and a.action like 'ENTRY_%') entries_moderated_7d,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day') and a.action like 'REVIEW_%') reviews_moderated_7d,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day')
        and (a.action like 'ADMIN_MESSAGE_%' or a.action like 'REPORT_%')) messages_handled_7d,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day') and a.action like 'CONTEST_%') contest_actions_7d,
      (select count(*) from admin_outbound_messages m where m.admin_id=u.id
        and m.status='SENT' and m.sent_at>=now()-($1::int*interval '1 day')) telegram_messages_sent_7d,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day')
        and a.action in ('ENTRY_APPROVED','ENTRY_PUBLISHED')) entry_approvals_period,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day')
        and a.action='ENTRY_REJECTED') entry_rejections_period,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day')
        and a.action in ('REVIEW_APPROVED','REVIEW_PUBLISHED')) review_approvals_period,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day')
        and a.action='REVIEW_REJECTED') review_rejections_period,
      (select count(*) from audit_logs a where a.actor_user_id=u.id
        and a.created_at>=now()-($1::int*interval '1 day')
        and a.action='CONTEST_PARTICIPATION_MODERATED') contest_decisions_period,
      (select count(*) from user_moderation_events e where e.admin_id=u.id
        and e.created_at>=now()-($1::int*interval '1 day')) sanctions_period
    from users u where u.role::text=any($2::text[]) and not u.is_system
      and ($3::uuid is null or u.id=$3::uuid)
    order by actions_7d desc,u.display_name asc limit $4 offset $5`,
    [
      input.days,
      roles,
      input.userId ?? null,
      100,
      0,
      getEnv().SESSION_MAX_DURATION_SECONDS,
      timezone,
    ],
  );
  const recentAudit = permissions.VIEW_TEAM_AUDIT_LOG
    ? await sql.unsafe<
        Array<{
          id: string;
          actor_user_id: string | null;
          actor_name: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          source: string;
          request_id: string | null;
          before_data: unknown;
          after_data: unknown;
          metadata: Record<string, unknown>;
          created_at: string;
        }>
      >(
        `select a.id,a.actor_user_id,u.display_name actor_name,
      coalesce(a.actor_role,u.role)::text actor_role,
      a.action,a.entity_type,a.entity_id,a.source::text,a.request_id,
      a.before_data,a.after_data,a.metadata,a.created_at
    from audit_logs a left join users u on u.id=a.actor_user_id
    where coalesce(a.actor_role,u.role)::text=any($1::text[])
      and a.created_at>=now()-($2::int*interval '1 day')
      and ($3::uuid is null or a.actor_user_id=$3::uuid)
    order by a.created_at desc limit $4`,
        [roles, input.days, input.userId ?? null, input.days <= 7 ? 50 : 100],
      )
    : [];
  const normalized = members.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    publicSlug: row.public_slug,
    telegramUsername: row.telegram_username,
    profilePhotoUrl: row.profile_photo_url,
    role: row.role,
    appointedAt: row.appointed_at,
    lastSeenAt: row.last_seen_at,
    isActive7d: row.is_active_7d,
    sessions7d: count(row.sessions_7d),
    activeDays7d: count(row.active_days_7d),
    actions7d: count(row.actions_7d),
    activeDurationSeconds: count(row.duration_seconds_period),
    sessions30d: count(row.sessions_30d),
    activeDays30d: count(row.active_days_30d),
    actions30d: count(row.actions_30d),
    entriesModerated7d: count(row.entries_moderated_7d),
    reviewsModerated7d: count(row.reviews_moderated_7d),
    messagesHandled7d: count(row.messages_handled_7d),
    contestActions7d: count(row.contest_actions_7d),
    telegramMessagesSent7d: count(row.telegram_messages_sent_7d),
    entryApprovalsPeriod: count(row.entry_approvals_period),
    entryRejectionsPeriod: count(row.entry_rejections_period),
    reviewApprovalsPeriod: count(row.review_approvals_period),
    reviewRejectionsPeriod: count(row.review_rejections_period),
    contestDecisionsPeriod: count(row.contest_decisions_period),
    sanctionsPeriod: count(row.sanctions_period),
  }));
  const sum = (key: keyof (typeof normalized)[number]) =>
    normalized.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  return {
    permissions,
    periodDays: input.days,
    ownerIncluded: includeOwner,
    activeStaff: normalized.filter((row) => row.sessions7d > 0 || row.actions7d > 0).length,
    activeStaff7d: normalized.filter((row) => row.isActive7d).length,
    activeAdmins7d: normalized.filter(
      (row) => row.isActive7d && (row.role === "OWNER" || row.role === "ADMIN"),
    ).length,
    activeModerators7d: normalized.filter((row) => row.isActive7d && row.role === "MODERATOR")
      .length,
    sessions: sum("sessions7d"),
    activeDurationSeconds: sum("activeDurationSeconds"),
    actions: sum("actions7d"),
    actions30d: sum("actions30d"),
    entriesModerated: sum("entriesModerated7d"),
    reviewsModerated: sum("reviewsModerated7d"),
    messagesHandled: sum("messagesHandled7d"),
    contestActions: sum("contestActions7d"),
    telegramMessagesSent: sum("telegramMessagesSent7d"),
    members: normalized,
    recentAudit: recentAudit.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source,
      requestId: row.request_id,
      before: row.before_data,
      after: row.after_data,
      metadata: row.metadata,
      createdAt: row.created_at,
    })),
  };
}

export async function listTeamAuditLogs(
  input: {
    days?: number;
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    role?: string;
    source?: string;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
    limit: number;
    offset: number;
  },
  actor: CurrentUser,
) {
  const roles = await visibleTeamAuditRoles(actor);
  const action = input.action ?? null;
  const entityType = input.entityType ?? null;
  const search = input.query ? `%${input.query.replace(/[\\%_]/g, "\\$&")}%` : null;
  const rows = await getSqlClient().unsafe<
    Array<{
      id: string;
      actor_user_id: string | null;
      actor_name: string | null;
      actor_role: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      source: string;
      request_id: string | null;
      before_data: unknown;
      after_data: unknown;
      metadata: Record<string, unknown>;
      created_at: string;
      total_count: CountValue;
    }>
  >(
    `select a.id,a.actor_user_id,u.display_name actor_name,
      coalesce(a.actor_role,u.role)::text actor_role,a.action,
      a.entity_type,a.entity_id,a.source::text,a.request_id,a.before_data,a.after_data,
      a.metadata,a.created_at,count(*) over() total_count
    from audit_logs a left join users u on u.id=a.actor_user_id
    where coalesce(a.actor_role,u.role)::text=any($1::text[])
      and ($2::int is null or a.created_at>=now()-($2::int*interval '1 day'))
      and ($3::uuid is null or a.actor_user_id=$3::uuid)
      and ($4::text is null or a.action=$4::text)
      and ($5::text is null or a.entity_type=$5::text)
      and ($6::text is null or a.entity_id::text=$6::text)
      and ($7::text is null or coalesce(a.actor_role,u.role)::text=$7::text)
      and ($8::text is null or a.source::text=$8::text)
      and ($9::date is null or a.created_at >= $9::date)
      and ($10::date is null or a.created_at < ($10::date + interval '1 day'))
      and ($11::text is null or a.action ilike $11 escape '\\'
        or a.entity_type ilike $11 escape '\\' or coalesce(u.display_name,'') ilike $11 escape '\\')
    order by a.created_at desc limit $12 offset $13`,
    [
      roles,
      input.days ?? null,
      input.actorId ?? null,
      action,
      entityType,
      input.entityId ?? null,
      input.role ?? null,
      input.source ?? null,
      input.dateFrom ?? null,
      input.dateTo ?? null,
      search,
      input.limit,
      input.offset,
    ],
  );
  return {
    logs: rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source,
      requestId: row.request_id,
      before: row.before_data,
      after: row.after_data,
      metadata: row.metadata,
      createdAt: row.created_at,
    })),
    total: count(rows[0]?.total_count),
  };
}

async function visibleTeamAuditRoles(actor: CurrentUser): Promise<string[]> {
  const permissions = await resolvedTeamPermissions(actor);
  if (!permissions.VIEW_TEAM_AUDIT_LOG) {
    throw forbidden("Journal d’équipe inaccessible.");
  }
  const roles: string[] = [];
  if (permissions.VIEW_ADMIN_ACTIVITY) roles.push("OWNER", "ADMIN");
  if (permissions.VIEW_MODERATOR_ACTIVITY) roles.push("MODERATOR");
  if (!roles.length) throw forbidden("Aucun journal d’équipe autorisé.");
  return roles;
}

export async function getTeamAuditLog(id: string, actor: CurrentUser) {
  const roles = await visibleTeamAuditRoles(actor);
  const [row] = await getSqlClient().unsafe<
    Array<{
      id: string;
      actor_user_id: string | null;
      actor_name: string | null;
      actor_role: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      source: string;
      request_id: string | null;
      before_data: unknown;
      after_data: unknown;
      metadata: Record<string, unknown>;
      created_at: string;
    }>
  >(
    `select a.id,a.actor_user_id,u.display_name actor_name,
      coalesce(a.actor_role,u.role)::text actor_role,a.action,
      a.entity_type,a.entity_id,a.source::text,a.request_id,a.before_data,a.after_data,
      a.metadata,a.created_at
    from audit_logs a left join users u on u.id=a.actor_user_id
    where a.id=$1::uuid
      and coalesce(a.actor_role,u.role)::text=any($2::text[])
    limit 1`,
    [id, roles],
  );
  if (!row) throw notFound("Trace d’audit");
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    source: row.source,
    requestId: row.request_id,
    before: row.before_data,
    after: row.after_data,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}
