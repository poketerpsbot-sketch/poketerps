import "server-only";

import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { aromaFamilies, aromas, auditLogs } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import { slugify } from "@/lib/validation/common";
import type { aromaInputSchema, updateAromaSchema } from "@/lib/validation/admin-management";

type AromaInput = z.infer<typeof aromaInputSchema>;
type AromaUpdate = z.infer<typeof updateAromaSchema>;

const selection = {
  id: aromas.id,
  familyId: aromas.familyId,
  slug: aromas.slug,
  name: aromas.name,
  description: aromas.description,
  synonyms: aromas.synonyms,
  translations: aromas.translations,
  sortOrder: aromas.sortOrder,
  isActive: aromas.isActive,
  createdAt: aromas.createdAt,
  updatedAt: aromas.updatedAt,
};

export async function listAdminAromaTaxonomy() {
  const db = getDb();
  const [families, aromaRows] = await Promise.all([
    db
      .select({
        id: aromaFamilies.id,
        slug: aromaFamilies.slug,
        name: aromaFamilies.name,
        sortOrder: aromaFamilies.sortOrder,
        isActive: aromaFamilies.isActive,
      })
      .from(aromaFamilies)
      .orderBy(asc(aromaFamilies.sortOrder), asc(aromaFamilies.name)),
    db.select(selection).from(aromas).orderBy(asc(aromas.sortOrder), asc(aromas.name)),
  ]);
  return { families, aromas: aromaRows };
}

async function ensureFamily(familyId: string) {
  const [family] = await getDb()
    .select({ id: aromaFamilies.id })
    .from(aromaFamilies)
    .where(and(eq(aromaFamilies.id, familyId), eq(aromaFamilies.isActive, true)))
    .limit(1);
  if (!family) throw new AppError("INVALID_AROMA_FAMILY", "Famille d’arômes invalide.", 400);
}

export async function createAroma(input: AromaInput, actor: CurrentUser, requestId?: string) {
  await ensureFamily(input.familyId);
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(aromas)
      .values({ ...input, slug: input.slug ?? slugify(input.name) })
      .returning(selection);
    if (!created) throw new Error("Aroma insert failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "AROMA_CREATED",
        entityType: "AROMA",
        entityId: created.id,
        source: "WEB_ADMIN",
        requestId,
        after: created,
      }),
    );
    return created;
  });
}

export async function updateAroma(
  id: string,
  input: AromaUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  if (input.familyId) await ensureFamily(input.familyId);
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select(selection)
      .from(aromas)
      .where(eq(aromas.id, id))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Arôme");
    const [updated] = await tx
      .update(aromas)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(aromas.id, id))
      .returning(selection);
    if (!updated) throw new Error("Aroma update failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: input.isActive === false ? "AROMA_DISABLED" : "AROMA_UPDATED",
        entityType: "AROMA",
        entityId: id,
        source: "WEB_ADMIN",
        requestId,
        before: existing,
        after: updated,
      }),
    );
    return updated;
  });
}
