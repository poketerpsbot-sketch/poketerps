import "server-only";

import { and, asc, count, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import { forbidden, notFound } from "@/lib/errors";
import type {
  adminUsersQuerySchema,
  updateAdminUserSchema,
} from "@/lib/validation/admin-management";

type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
type AdminUserUpdate = z.infer<typeof updateAdminUserSchema>;

type AdminUserListMetric = {
  user_id: string;
  capture_count: number | string;
  review_count: number | string;
  badge_id: string | null;
  badge_slug: string | null;
  badge_name: string | null;
  badge_icon: string | null;
};

const roleWeight: Record<UserRole, number> = {
  OWNER: 5,
  ADMIN: 4,
  MODERATOR: 3,
  EDITOR: 2,
  MEMBER: 1,
  BANNED: 0,
};

const adminUserSelection = {
  id: users.id,
  accountKind: users.accountKind,
  isSystem: users.isSystem,
  telegramUsername: users.telegramUsername,
  displayName: users.displayName,
  publicSlug: users.publicSlug,
  profilePhotoUrl: users.profilePhotoUrl,
  role: users.role,
  experiencePoints: users.experiencePoints,
  level: users.level,
  isBanned: users.isBanned,
  suspendedAt: users.suspendedAt,
  suspensionReason: users.suspensionReason,
  suspensionUntil: users.bannedUntil,
  bannedById: users.bannedById,
  roleBeforeBan: users.roleBeforeBan,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastSeenAt: users.lastSeenAt,
};

export function assertCanManageUser(
  actor: Pick<CurrentUser, "id" | "role">,
  target: { id: string; role: UserRole; isSystem: boolean },
  requestedRole?: UserRole,
): void {
  if (canManageUser(actor, target, requestedRole)) return;
  if (target.isSystem) throw forbidden("Le compte système ne peut pas être modifié.");
  if (target.id === actor.id) throw forbidden("Vous ne pouvez pas modifier votre propre accès.");
  if (target.role === "OWNER") throw forbidden("Le rôle OWNER est protégé.");
  if (roleWeight[target.role] >= roleWeight[actor.role])
    throw forbidden("Vous ne pouvez pas modifier un compte de niveau égal ou supérieur.");
  throw forbidden("Vous ne pouvez pas attribuer ce rôle.");
}

export function canManageUser(
  actor: Pick<CurrentUser, "id" | "role">,
  target: { id: string; role: UserRole; isSystem: boolean },
  requestedRole?: UserRole,
): boolean {
  return !(
    target.isSystem ||
    target.id === actor.id ||
    target.role === "OWNER" ||
    roleWeight[target.role] >= roleWeight[actor.role] ||
    requestedRole === "OWNER" ||
    (requestedRole !== undefined && roleWeight[requestedRole] >= roleWeight[actor.role])
  );
}

export async function listAdminUsers(query: AdminUsersQuery, actor: CurrentUser) {
  const conditions: SQL[] = [];
  if (query.query) {
    const pattern = `%${query.query.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(users.displayName, pattern),
        ilike(users.publicSlug, pattern),
        ilike(users.telegramUsername, pattern),
      ) as SQL,
    );
  }
  if (query.role) conditions.push(eq(users.role, query.role));
  if (query.banned === true) {
    conditions.push(or(eq(users.isBanned, true), eq(users.role, "BANNED")) as SQL);
  } else if (query.banned === false) {
    conditions.push(and(eq(users.isBanned, false), ne(users.role, "BANNED")) as SQL);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select(adminUserSelection)
      .from(users)
      .where(where)
      .orderBy(asc(users.isSystem), asc(users.displayName))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(users).where(where),
  ]);
  const metrics = rows.length
    ? await getSqlClient().unsafe<AdminUserListMetric[]>(
        `select u.id user_id,
          coalesce(captures.capture_count,0)::int capture_count,
          coalesce(review_stats.review_count,0)::int review_count,
          featured_badge.id badge_id,featured_badge.slug badge_slug,
          featured_badge.name badge_name,featured_badge.icon badge_icon
        from users u
        left join lateral (
          select count(*)::int capture_count from entries e
          where e.original_contributor_id=u.id and e.deleted_at is null
            and e.status in ('APPROVED','PUBLISHED','HIDDEN','ARCHIVED')
        ) captures on true
        left join lateral (
          select count(*)::int review_count from reviews r
          where r.user_id=u.id and r.deleted_at is null
            and r.status in ('APPROVED','PUBLISHED','HIDDEN')
        ) review_stats on true
        left join lateral (
          select b.id,b.slug,b.name,b.icon
          from user_badges ub join badges b on b.id=ub.badge_id
          where ub.user_id=u.id and ub.is_active=true and b.is_active=true
            and (ub.active_from is null or ub.active_from<=now())
            and (ub.active_until is null or ub.active_until>now())
          order by b.sort_order desc,ub.awarded_at desc limit 1
        ) featured_badge on true
        where u.id=any($1::uuid[])`,
        [rows.map((user) => user.id)],
      )
    : [];
  const metricsByUser = new Map(metrics.map((metric) => [metric.user_id, metric]));
  return {
    users: rows.map((user) => {
      const metric = metricsByUser.get(user.id);
      return {
        ...user,
        captureCount: Number(metric?.capture_count ?? 0),
        reviewCount: Number(metric?.review_count ?? 0),
        badge: metric?.badge_name
          ? {
              id: metric.badge_id,
              slug: metric.badge_slug,
              name: metric.badge_name,
              icon: metric.badge_icon,
            }
          : null,
        canManage: canManageUser(actor, {
          id: user.id,
          role: user.role === "BANNED" ? (user.roleBeforeBan ?? user.role) : user.role,
          isSystem: user.isSystem,
        }),
      };
    }),
    total: Number(totals[0]?.total ?? 0),
  };
}

export async function updateAdminUser(
  id: string,
  input: AdminUserUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return getSqlClient().begin(async (tx) => {
    const [existing] = await tx<
      Array<{
        id: string;
        account_kind: string;
        is_system: boolean;
        telegram_id: number | string | null;
        telegram_username: string | null;
        display_name: string;
        public_slug: string;
        profile_photo_url: string | null;
        role: UserRole;
        experience_points: number | string;
        level: number;
        is_banned: boolean;
        suspended_at: string | null;
        suspension_reason: string | null;
        banned_until: string | null;
        banned_by_id: string | null;
        role_before_ban: UserRole | null;
        created_at: string;
        updated_at: string;
        last_seen_at: string | null;
      }>
    >`
      select id,account_kind::text,is_system,telegram_id,telegram_username,display_name,
        public_slug,profile_photo_url,role::text,experience_points,level,is_banned,
        suspended_at,suspension_reason,banned_until,banned_by_id,role_before_ban::text,
        created_at,updated_at,last_seen_at
      from users where id=${id}::uuid for update
    `;
    if (!existing) throw notFound("Utilisateur");
    const protectedExistingRole =
      existing.role === "BANNED" ? (existing.role_before_ban ?? existing.role) : existing.role;
    assertCanManageUser(
      actor,
      { id: existing.id, role: protectedExistingRole, isSystem: existing.is_system },
      input.role,
    );

    const banning = input.isBanned === true || input.role === "BANNED";
    const restoring = input.isBanned === false;
    const previousRole = protectedExistingRole;
    const role: UserRole = banning
      ? "BANNED"
      : restoring
        ? input.role && input.role !== "BANNED"
          ? input.role
          : (existing.role_before_ban ?? "MEMBER")
        : (input.role ?? existing.role);
    const isBanned = banning ? true : restoring ? false : existing.is_banned;
    const suspensionUntil = banning
      ? input.suspensionUntil === undefined
        ? new Date(Date.now() + 7 * 86_400_000).toISOString()
        : input.suspensionUntil
      : restoring
        ? null
        : existing.banned_until;
    const suspensionReason = banning
      ? input.suspensionReason!
      : restoring
        ? null
        : existing.suspension_reason;
    const roleBeforeBan = banning
      ? (previousRole ?? "MEMBER")
      : restoring
        ? null
        : existing.role_before_ban;
    const [updated] = await tx<
      Array<{
        id: string;
        account_kind: string;
        is_system: boolean;
        telegram_id: number | string | null;
        telegram_username: string | null;
        display_name: string;
        public_slug: string;
        profile_photo_url: string | null;
        role: UserRole;
        experience_points: number | string;
        level: number;
        is_banned: boolean;
        suspended_at: string | null;
        suspension_reason: string | null;
        banned_until: string | null;
        banned_by_id: string | null;
        role_before_ban: UserRole | null;
        created_at: string;
        updated_at: string;
        last_seen_at: string | null;
      }>
    >`
      update users set
        role=${role}::user_role,
        is_banned=${isBanned},
        suspended_at=${banning ? new Date().toISOString() : restoring ? null : existing.suspended_at}::timestamptz,
        suspension_reason=${suspensionReason},
        banned_until=${suspensionUntil}::timestamptz,
        banned_by_id=${banning ? actor.id : restoring ? null : existing.banned_by_id}::uuid,
        role_before_ban=${roleBeforeBan}::user_role,
        updated_at=now()
      where id=${id}::uuid
      returning id,account_kind::text,is_system,telegram_id,telegram_username,display_name,
        public_slug,profile_photo_url,role::text,experience_points,level,is_banned,
        suspended_at,suspension_reason,banned_until,banned_by_id,role_before_ban::text,
        created_at,updated_at,last_seen_at
    `;
    if (!updated) throw new Error("User update failed");

    const roleChanged = updated.role !== existing.role;
    const banChanged = updated.is_banned !== existing.is_banned;
    if (banning || restoring) {
      await tx`
        insert into user_moderation_events(
          user_id,admin_id,action,reason,starts_at,ends_at,previous_role,metadata
        ) values (
          ${id}::uuid,${actor.id}::uuid,
          ${banning ? "BAN" : "UNBAN"}::user_moderation_action,
          ${banning ? input.suspensionReason! : input.restorationReason!},now(),
          ${banning ? suspensionUntil : null}::timestamptz,
          ${banning ? previousRole : existing.role}::user_role,
          jsonb_build_object('requestId',${requestId ?? null}::text,'restoredRole',${restoring ? role : null}::text)
        )
      `;
    }
    if (roleChanged) {
      const reason = banning
        ? input.suspensionReason
        : restoring
          ? input.restorationReason
          : input.roleChangeReason;
      await tx`
        update role_history set reason=coalesce(${reason ?? null},reason),
          changed_by_id=${actor.id}::uuid,source='WEB_ADMIN'
        where id=(select id from role_history where user_id=${id}::uuid
          order by created_at desc limit 1)
      `;
    }
    const action = banChanged
      ? updated.is_banned
        ? "USER_BANNED"
        : "USER_RESTORED"
      : roleChanged
        ? "USER_ROLE_CHANGED"
        : "USER_UPDATED";
    await tx`
      insert into audit_logs(
        actor_user_id,actor_telegram_id_snapshot,actor_role,action,entity_type,
        entity_id,source,before_data,after_data,metadata,request_id
      ) values (
        ${actor.id}::uuid,${actor.telegramId},${actor.role}::user_role,${action},'USER',
        ${id}::uuid,'WEB_ADMIN',
        jsonb_build_object('role',${existing.role}::text,'isBanned',${existing.is_banned},
          'suspendedAt',${existing.suspended_at}::text,'suspensionReason',${existing.suspension_reason}::text,
          'bannedUntil',${existing.banned_until}::text),
        jsonb_build_object('role',${updated.role}::text,'isBanned',${updated.is_banned},
          'suspendedAt',${updated.suspended_at}::text,'suspensionReason',${updated.suspension_reason}::text,
          'bannedUntil',${updated.banned_until}::text),
        '{}'::jsonb,${requestId ?? null}
      )
    `;
    return {
      id: updated.id,
      accountKind: updated.account_kind,
      isSystem: updated.is_system,
      telegramUsername: updated.telegram_username,
      displayName: updated.display_name,
      publicSlug: updated.public_slug,
      profilePhotoUrl: updated.profile_photo_url,
      role: updated.role,
      experiencePoints: Number(updated.experience_points),
      level: updated.level,
      isBanned: updated.is_banned,
      suspendedAt: updated.suspended_at,
      suspensionReason: updated.suspension_reason,
      suspensionUntil: updated.banned_until,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      lastSeenAt: updated.last_seen_at,
    };
  });
}
