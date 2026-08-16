import "server-only";

import { asc, eq } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { auditLogs, experienceRules, levelDefinitions } from "@/lib/db/schema";
import { notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import type {
  updateExperienceRuleSchema,
  updateLevelDefinitionSchema,
} from "@/lib/validation/experience";

type RuleUpdate = z.infer<typeof updateExperienceRuleSchema>;
type LevelUpdate = z.infer<typeof updateLevelDefinitionSchema>;

export async function getExperienceConfiguration() {
  const db = getDb();
  const [rules, levels] = await Promise.all([
    db.select().from(experienceRules).orderBy(asc(experienceRules.key)),
    db.select().from(levelDefinitions).orderBy(asc(levelDefinitions.level)),
  ]);
  return { rules, levels };
}

export async function updateExperienceRule(
  key: string,
  input: RuleUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(experienceRules)
      .where(eq(experienceRules.key, key))
      .limit(1)
      .for("update");
    if (!before) throw notFound("Règle XP");
    const [after] = await tx
      .update(experienceRules)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(experienceRules.key, key))
      .returning();
    if (!after) throw new Error("Experience rule update failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "EXPERIENCE_RULE_UPDATED",
        entityType: "EXPERIENCE_RULE",
        source: "WEB_ADMIN",
        requestId,
        before,
        after,
        metadata: { key },
      }),
    );
    return after;
  });
}

export async function updateLevelDefinition(
  level: number,
  input: LevelUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(levelDefinitions)
      .where(eq(levelDefinitions.level, level))
      .limit(1)
      .for("update");
    if (!before) throw notFound("Niveau");
    const [after] = await tx
      .update(levelDefinitions)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(levelDefinitions.level, level))
      .returning();
    if (!after) throw new Error("Level definition update failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "LEVEL_DEFINITION_UPDATED",
        entityType: "LEVEL_DEFINITION",
        source: "WEB_ADMIN",
        requestId,
        before,
        after,
        metadata: { level },
      }),
    );
    return after;
  });
}
