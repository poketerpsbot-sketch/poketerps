import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  badges,
  experienceRules,
  levelDefinitions,
  userBadges,
  userExperienceEvents,
  users,
} from "@/lib/db/schema";
import { experienceProgress } from "@/lib/xp";

export type ExperienceRuleKey =
  | "ENTRY_PUBLISHED"
  | "REVIEW_PUBLISHED"
  | "FIRST_ENTRY_BONUS"
  | "FIRST_REVIEW_BONUS"
  | "CONTEST_PARTICIPATION"
  | "CONTEST_WIN";

type ExperienceExecutor = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function awardConfiguredExperience(
  executor: ExperienceExecutor,
  input: {
    userId: string;
    ruleKey: ExperienceRuleKey;
    idempotencyKey: string;
    reason: string;
    sourceType: string;
    sourceId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const [rule] = await executor
    .select({ points: experienceRules.points })
    .from(experienceRules)
    .where(and(eq(experienceRules.key, input.ruleKey), eq(experienceRules.isActive, true)))
    .limit(1);
  if (!rule || rule.points === 0) return null;
  const [event] = await executor
    .insert(userExperienceEvents)
    .values({
      userId: input.userId,
      points: rule.points,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      idempotencyKey: input.idempotencyKey,
      metadata: { ruleKey: input.ruleKey, ...(input.metadata ?? {}) },
    })
    .onConflictDoNothing({ target: userExperienceEvents.idempotencyKey })
    .returning({ id: userExperienceEvents.id, points: userExperienceEvents.points });
  if (event) await syncProgressBadges(executor, input.userId);
  return event ?? null;
}

export async function ensureUserBadge(
  executor: ExperienceExecutor,
  input: { userId: string; slug: string; sourceType: string; sourceId?: string | null },
) {
  await executor.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`badge:${input.userId}:${input.slug}`},0))`,
  );
  const [badge] = await executor
    .select({ id: badges.id, xpReward: badges.xpReward })
    .from(badges)
    .where(and(eq(badges.slug, input.slug), eq(badges.isActive, true)))
    .limit(1);
  if (!badge) return null;
  const [existing] = await executor
    .select({ id: userBadges.id })
    .from(userBadges)
    .where(
      and(
        eq(userBadges.userId, input.userId),
        eq(userBadges.badgeId, badge.id),
        eq(userBadges.isActive, true),
      ),
    )
    .limit(1);
  if (existing) return existing;
  const [assignment] = await executor
    .insert(userBadges)
    .values({
      userId: input.userId,
      badgeId: badge.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      metadata: { automatic: true },
    })
    .returning({ id: userBadges.id });
  if (assignment && badge.xpReward > 0) {
    await executor
      .insert(userExperienceEvents)
      .values({
        userId: input.userId,
        points: badge.xpReward,
        reason: `Badge « ${input.slug} » débloqué`,
        sourceType: "BADGE",
        sourceId: badge.id,
        idempotencyKey: `BADGE_REWARD:${badge.id}:${input.userId}`,
        metadata: { badgeSlug: input.slug },
      })
      .onConflictDoNothing({ target: userExperienceEvents.idempotencyKey });
  }
  return assignment ?? null;
}

async function syncProgressBadges(executor: ExperienceExecutor, userId: string) {
  const [user] = await executor
    .select({ level: users.level })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;
  const levelSlugs = [
    ...(user.level >= 1 ? ["level-1"] : []),
    ...(user.level >= 5 ? ["level-5"] : []),
    ...(user.level >= 10 ? ["level-10"] : []),
    ...(user.level >= 15 ? ["level-15"] : []),
  ];
  const available = await executor
    .select({ slug: badges.slug })
    .from(badges)
    .where(and(inArray(badges.slug, levelSlugs), eq(badges.isActive, true)));
  for (const badge of available) {
    await ensureUserBadge(executor, { userId, slug: badge.slug, sourceType: "LEVEL" });
  }
}

export async function getExperienceOverview(userId: string, limit = 50) {
  const db = getDb();
  const [userRows, events, rules, levels] = await Promise.all([
    db
      .select({ experiencePoints: users.experiencePoints })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        id: userExperienceEvents.id,
        points: userExperienceEvents.points,
        reason: userExperienceEvents.reason,
        sourceType: userExperienceEvents.sourceType,
        sourceId: userExperienceEvents.sourceId,
        metadata: userExperienceEvents.metadata,
        createdAt: userExperienceEvents.createdAt,
      })
      .from(userExperienceEvents)
      .where(eq(userExperienceEvents.userId, userId))
      .orderBy(desc(userExperienceEvents.createdAt))
      .limit(Math.min(100, Math.max(1, limit))),
    db
      .select({
        key: experienceRules.key,
        label: experienceRules.label,
        points: experienceRules.points,
      })
      .from(experienceRules)
      .where(eq(experienceRules.isActive, true))
      .orderBy(desc(experienceRules.points)),
    db
      .select({
        level: levelDefinitions.level,
        threshold: levelDefinitions.threshold,
        title: levelDefinitions.title,
      })
      .from(levelDefinitions)
      .where(eq(levelDefinitions.isActive, true))
      .orderBy(levelDefinitions.level),
  ]);
  const points = userRows[0]?.experiencePoints ?? 0;
  return { progress: experienceProgress(points), events, rules, levels };
}
