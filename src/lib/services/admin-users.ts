import "server-only";

import { and, asc, count, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { auditLogs, users, type UserRole } from "@/lib/db/schema";
import { forbidden, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import type {
  adminUsersQuerySchema,
  updateAdminUserSchema,
} from "@/lib/validation/admin-management";

type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
type AdminUserUpdate = z.infer<typeof updateAdminUserSchema>;

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
  telegramId: users.telegramId,
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
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastSeenAt: users.lastSeenAt,
};

export function assertCanManageUser(
  actor: Pick<CurrentUser, "id" | "role">,
  target: { id: string; role: UserRole; isSystem: boolean },
  requestedRole?: UserRole,
): void {
  if (target.isSystem) throw forbidden("Le compte système ne peut pas être modifié.");
  if (target.id === actor.id) throw forbidden("Vous ne pouvez pas modifier votre propre accès.");
  if (target.role === "OWNER") throw forbidden("Le rôle OWNER est protégé.");
  if (roleWeight[target.role] >= roleWeight[actor.role]) {
    throw forbidden("Vous ne pouvez pas modifier un compte de niveau égal ou supérieur.");
  }
  if (
    requestedRole === "OWNER" ||
    (requestedRole && roleWeight[requestedRole] >= roleWeight[actor.role])
  ) {
    throw forbidden("Vous ne pouvez pas attribuer ce rôle.");
  }
}

export async function listAdminUsers(query: AdminUsersQuery) {
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
  return { users: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function updateAdminUser(
  id: string,
  input: AdminUserUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select(adminUserSelection)
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Utilisateur");
    assertCanManageUser(actor, existing, input.role);

    const now = new Date();
    const role =
      input.isBanned === false && existing.role === "BANNED" && input.role === undefined
        ? "MEMBER"
        : input.role;
    const isBanned = input.role === "BANNED" ? true : input.isBanned;
    const [updated] = await tx
      .update(users)
      .set({
        role,
        isBanned,
        suspendedAt: isBanned === true ? now : isBanned === false ? null : undefined,
        suspensionReason:
          isBanned === true ? input.suspensionReason : isBanned === false ? null : undefined,
        updatedAt: now,
      })
      .where(eq(users.id, id))
      .returning(adminUserSelection);
    if (!updated) throw new Error("User update failed");

    const roleChanged = updated.role !== existing.role;
    const banChanged = updated.isBanned !== existing.isBanned;
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: banChanged
          ? updated.isBanned
            ? "USER_BANNED"
            : "USER_RESTORED"
          : roleChanged
            ? "USER_ROLE_CHANGED"
            : "USER_UPDATED",
        entityType: "USER",
        entityId: id,
        requestId,
        before: {
          role: existing.role,
          isBanned: existing.isBanned,
          suspendedAt: existing.suspendedAt,
          suspensionReason: existing.suspensionReason,
        },
        after: {
          role: updated.role,
          isBanned: updated.isBanned,
          suspendedAt: updated.suspendedAt,
          suspensionReason: updated.suspensionReason,
        },
      }),
    );
    return updated;
  });
}
