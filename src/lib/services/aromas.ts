import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { aromaFamilies, aromas } from "@/lib/db/schema";

export async function listAromaFamilies() {
  const db = getDb();
  const [familyRows, aromaRows] = await Promise.all([
    db
      .select({
        id: aromaFamilies.id,
        slug: aromaFamilies.slug,
        name: aromaFamilies.name,
        sortOrder: aromaFamilies.sortOrder,
      })
      .from(aromaFamilies)
      .where(eq(aromaFamilies.isActive, true))
      .orderBy(asc(aromaFamilies.sortOrder), asc(aromaFamilies.name)),
    db
      .select({
        id: aromas.id,
        familyId: aromas.familyId,
        slug: aromas.slug,
        name: aromas.name,
        synonyms: aromas.synonyms,
        sortOrder: aromas.sortOrder,
      })
      .from(aromas)
      .where(and(eq(aromas.isActive, true), eq(aromaFamilies.isActive, true)))
      .innerJoin(aromaFamilies, eq(aromas.familyId, aromaFamilies.id))
      .orderBy(asc(aromas.sortOrder), asc(aromas.name)),
  ]);

  const aromasByFamily = new Map<string, typeof aromaRows>();
  for (const aroma of aromaRows) {
    const familyAromas = aromasByFamily.get(aroma.familyId) ?? [];
    familyAromas.push(aroma);
    aromasByFamily.set(aroma.familyId, familyAromas);
  }

  return familyRows.map((family) => ({
    ...family,
    aromas: aromasByFamily.get(family.id) ?? [],
  }));
}
