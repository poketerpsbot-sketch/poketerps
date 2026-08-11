import "server-only";

import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { auditLogs, badges, userBadges, users } from "@/lib/db/schema";
import { conflict, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import type {
  adminBadgesQuerySchema,
  assignBadgeSchema,
  badgeAssignmentsQuerySchema,
  badgeInputSchema,
  updateBadgeAssignmentSchema,
  updateBadgeSchema,
} from "@/lib/validation/admin-management";

type BadgeInput = z.infer<typeof badgeInputSchema>;
type BadgeUpdate = z.infer<typeof updateBadgeSchema>;
type BadgeQuery = z.infer<typeof adminBadgesQuerySchema>;
type BadgeAssignmentInput = z.infer<typeof assignBadgeSchema>;
type BadgeAssignmentsQuery = z.infer<typeof badgeAssignmentsQuerySchema>;
type BadgeAssignmentUpdate = z.infer<typeof updateBadgeAssignmentSchema>;

const badgeSelection = {
  id: badges.id,
  slug: badges.slug,
  name: badges.name,
  description: badges.description,
  icon: badges.icon,
  kind: badges.kind,
  criteria: badges.criteria,
  isActive: badges.isActive,
  sortOrder: badges.sortOrder,
  createdAt: badges.createdAt,
  updatedAt: badges.updatedAt,
};

const assignmentSelection = {
  id: userBadges.id,
  userId: userBadges.userId,
  badgeId: userBadges.badgeId,
  awardedById: userBadges.awardedById,
  isActive: userBadges.isActive,
  activeFrom: userBadges.activeFrom,
  activeUntil: userBadges.activeUntil,
  metadata: userBadges.metadata,
  awardedAt: userBadges.awardedAt,
  revokedAt: userBadges.revokedAt,
  revokeReason: userBadges.revokeReason,
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function badgeTransaction<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Ce slug de badge existe déjà.", "BADGE_CONFLICT");
    }
    throw error;
  }
}

export async function listAdminBadges(query: BadgeQuery) {
  const conditions: SQL[] = [];
  if (query.query) {
    const pattern = `%${query.query.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(or(ilike(badges.name, pattern), ilike(badges.slug, pattern)) as SQL);
  }
  if (!query.includeInactive) conditions.push(eq(badges.isActive, true));
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select(badgeSelection)
      .from(badges)
      .where(where)
      .orderBy(asc(badges.sortOrder), asc(badges.name))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(badges).where(where),
  ]);
  return { badges: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function createBadge(input: BadgeInput, actor: CurrentUser, requestId?: string) {
  return badgeTransaction(() =>
    getDb().transaction(async (tx) => {
      const [created] = await tx.insert(badges).values(input).returning(badgeSelection);
      if (!created) throw new Error("Badge insert failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "BADGE_CREATED",
          entityType: "BADGE",
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

export async function updateBadge(
  id: string,
  input: BadgeUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return badgeTransaction(() =>
    getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select(badgeSelection)
        .from(badges)
        .where(eq(badges.id, id))
        .limit(1)
        .for("update");
      if (!existing) throw notFound("Badge");
      const [updated] = await tx
        .update(badges)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(badges.id, id))
        .returning(badgeSelection);
      if (!updated) throw new Error("Badge update failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action:
            input.isActive === false
              ? "BADGE_HIDDEN"
              : input.isActive === true
                ? "BADGE_RESTORED"
                : "BADGE_UPDATED",
          entityType: "BADGE",
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

export async function assignBadge(
  badgeId: string,
  input: BadgeAssignmentInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${badgeId}:${input.userId}`}, 0))`,
    );
    const [badge] = await tx
      .select({ id: badges.id, isActive: badges.isActive })
      .from(badges)
      .where(eq(badges.id, badgeId))
      .limit(1);
    const [user] = await tx
      .select({ id: users.id, isSystem: users.isSystem })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    const [activeAssignment] = await tx
      .select({ id: userBadges.id })
      .from(userBadges)
      .where(
        and(
          eq(userBadges.badgeId, badgeId),
          eq(userBadges.userId, input.userId),
          eq(userBadges.isActive, true),
        ),
      )
      .orderBy(desc(userBadges.awardedAt))
      .limit(1)
      .for("update");
    if (!badge) throw notFound("Badge");
    if (!badge.isActive) throw conflict("Ce badge est masqué et ne peut pas être attribué.");
    if (!user || user.isSystem) throw notFound("Utilisateur");
    if (activeAssignment) throw conflict("Cet utilisateur possède déjà ce badge.");
    const [created] = await tx
      .insert(userBadges)
      .values({
        badgeId,
        userId: input.userId,
        awardedById: actor.id,
        activeFrom: input.activeFrom ? new Date(input.activeFrom) : null,
        activeUntil: input.activeUntil ? new Date(input.activeUntil) : null,
        metadata: input.metadata,
      })
      .returning(assignmentSelection);
    if (!created) throw new Error("Badge assignment insert failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "BADGE_ASSIGNED",
        entityType: "USER_BADGE",
        entityId: created.id,
        source: "WEB_ADMIN",
        requestId,
        after: created,
        metadata: { badgeId, userId: input.userId },
      }),
    );
    return created;
  });
}

export async function listBadgeAssignments(badgeId: string, query: BadgeAssignmentsQuery) {
  const conditions: SQL[] = [eq(userBadges.badgeId, badgeId)];
  if (query.userId) conditions.push(eq(userBadges.userId, query.userId));
  if (query.active !== undefined) conditions.push(eq(userBadges.isActive, query.active));
  const where = and(...conditions);
  const db = getDb();
  const [badge, rows, totals] = await Promise.all([
    db.select({ id: badges.id }).from(badges).where(eq(badges.id, badgeId)).limit(1),
    db
      .select({
        ...assignmentSelection,
        user: {
          id: users.id,
          displayName: users.displayName,
          publicSlug: users.publicSlug,
          telegramUsername: users.telegramUsername,
        },
      })
      .from(userBadges)
      .innerJoin(users, eq(userBadges.userId, users.id))
      .where(where)
      .orderBy(desc(userBadges.awardedAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(userBadges).where(where),
  ]);
  if (!badge[0]) throw notFound("Badge");
  return { assignments: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function updateBadgeAssignment(
  id: string,
  input: BadgeAssignmentUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select(assignmentSelection)
      .from(userBadges)
      .where(eq(userBadges.id, id))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Attribution de badge");
    if (input.isActive && !existing.isActive) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${existing.badgeId}:${existing.userId}`}, 0))`,
      );
      const [duplicate] = await tx
        .select({ id: userBadges.id })
        .from(userBadges)
        .where(
          and(
            eq(userBadges.badgeId, existing.badgeId),
            eq(userBadges.userId, existing.userId),
            eq(userBadges.isActive, true),
          ),
        )
        .limit(1);
      if (duplicate) throw conflict("Une attribution active existe déjà pour ce badge.");
    }
    const [updated] = await tx
      .update(userBadges)
      .set({
        isActive: input.isActive,
        revokedAt: input.isActive ? null : new Date(),
        revokeReason: input.isActive ? null : input.reason,
      })
      .where(eq(userBadges.id, id))
      .returning(assignmentSelection);
    if (!updated) throw new Error("Badge assignment update failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: input.isActive ? "BADGE_ASSIGNMENT_RESTORED" : "BADGE_REVOKED",
        entityType: "USER_BADGE",
        entityId: id,
        source: "WEB_ADMIN",
        requestId,
        before: existing,
        after: updated,
        metadata: { badgeId: existing.badgeId, userId: existing.userId },
      }),
    );
    return updated;
  });
}
