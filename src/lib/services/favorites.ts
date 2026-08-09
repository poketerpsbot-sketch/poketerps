import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { categories, entries, favorites } from "@/lib/db/schema";
import { notFound } from "@/lib/errors";
import { publicStorageUrl } from "@/lib/services/storage-url";
import { sql } from "drizzle-orm";

export async function addFavorite(entryId: string, userId: string) {
  const [entry] = await getDb()
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.status, "PUBLISHED"), isNull(entries.deletedAt)))
    .limit(1);
  if (!entry) throw notFound("Capture");
  const inserted = await getDb()
    .insert(favorites)
    .values({ entryId, userId })
    .onConflictDoNothing({ target: [favorites.userId, favorites.entryId] })
    .returning({ id: favorites.id });
  return { favorited: true, created: inserted.length > 0 };
}

export async function removeFavorite(entryId: string, userId: string) {
  const deleted = await getDb()
    .delete(favorites)
    .where(and(eq(favorites.entryId, entryId), eq(favorites.userId, userId)))
    .returning({ id: favorites.id });
  return { favorited: false, removed: deleted.length > 0 };
}

export async function listFavorites(userId: string, limit: number, offset: number) {
  const rows = await getDb()
    .select({
      id: entries.id,
      publicNumber: entries.publicNumber,
      slug: entries.slug,
      name: entries.name,
      shortDescription: entries.shortDescription,
      averageRating: entries.averageRating,
      viewCount: entries.viewCount,
      likeCount: entries.likeCount,
      favoriteCount: entries.favoriteCount,
      category: { id: categories.id, slug: categories.slug, name: categories.name },
      favoritedAt: favorites.createdAt,
      primaryImagePath: sql<string | null>`(
        select object_path from entry_images image where image.entry_id=${entries.id} and image.deleted_at is null
        order by image.is_primary desc, image.sort_order asc limit 1
      )`,
    })
    .from(favorites)
    .innerJoin(entries, eq(favorites.entryId, entries.id))
    .innerJoin(categories, eq(entries.categoryId, categories.id))
    .where(
      and(eq(favorites.userId, userId), eq(entries.status, "PUBLISHED"), isNull(entries.deletedAt)),
    )
    .orderBy(desc(favorites.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map(({ primaryImagePath, ...entry }) => ({
    ...entry,
    primaryImageUrl: publicStorageUrl("entry-images", primaryImagePath),
  }));
}
