import "server-only";

import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  categories,
  aromaFamilies,
  aromas,
  entries,
  entryFieldValues,
  entryImages,
  entryAromas,
  entryMicronContexts,
  entryTags,
  micronSpecifications,
  subcategories,
  tags,
  users,
} from "@/lib/db/schema";
import { notFound } from "@/lib/errors";
import { hasPermission } from "@/lib/auth/rbac";
import type { CurrentUser } from "@/lib/auth/current-user";
import { publicStorageUrl } from "@/lib/services/storage-url";
import type { z } from "zod";
import type { catalogueQuerySchema } from "@/lib/validation/entries";

type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

function escapedLike(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function publicEntrySelection() {
  return {
    id: entries.id,
    publicNumber: entries.publicNumber,
    slug: entries.slug,
    name: entries.name,
    shortDescription: entries.shortDescription,
    rarity: entries.rarity,
    status: entries.status,
    averageRating: entries.averageRating,
    reviewCount: entries.reviewCount,
    viewCount: entries.viewCount,
    likeCount: entries.likeCount,
    favoriteCount: entries.favoriteCount,
    publishedAt: entries.publishedAt,
    category: {
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      icon: categories.icon,
    },
    subcategory: { id: subcategories.id, slug: subcategories.slug, name: subcategories.name },
    author: {
      slug: users.publicSlug,
      displayName: users.displayName,
      username: users.telegramUsername,
      profilePhotoUrl: users.profilePhotoUrl,
      title: users.profileTitle,
    },
    primaryImagePath: sql<string | null>`(
      select image.object_path
      from entry_images image
      where image.entry_id = ${entries.id} and image.deleted_at is null
      order by image.is_primary desc, image.sort_order asc, image.created_at asc
      limit 1
    )`,
  };
}

export async function searchCatalogue(query: CatalogueQuery) {
  const db = getDb();
  const conditions: SQL[] = [eq(entries.status, "PUBLISHED"), isNull(entries.deletedAt)];
  if (query.query) {
    const pattern = escapedLike(query.query);
    conditions.push(
      or(
        ilike(entries.name, pattern),
        ilike(entries.shortDescription, pattern),
        ilike(users.displayName, pattern),
        ilike(users.telegramUsername, pattern),
        sql`${entries.publicNumber}::text ilike ${pattern}`,
      )!,
    );
  }
  if (query.category) {
    conditions.push(
      or(eq(categories.slug, query.category), sql`${categories.id}::text = ${query.category}`)!,
    );
  }
  if (query.subcategory) {
    conditions.push(
      or(
        eq(subcategories.slug, query.subcategory),
        sql`${subcategories.id}::text = ${query.subcategory}`,
      )!,
    );
  }
  if (query.author) {
    const pattern = escapedLike(query.author);
    conditions.push(
      or(
        ilike(users.publicSlug, pattern),
        ilike(users.displayName, pattern),
        ilike(users.telegramUsername, pattern),
      )!,
    );
  }
  if (query.tag) {
    conditions.push(sql`exists (
      select 1 from entry_tags et join tags t on t.id = et.tag_id
      where et.entry_id = ${entries.id} and (t.slug = ${query.tag} or t.id::text = ${query.tag})
    )`);
  }
  if (query.minRating !== undefined)
    conditions.push(sql`${entries.averageRating}::numeric >= ${query.minRating}`);
  if (query.micronMin !== undefined) {
    conditions.push(sql`exists (
      select 1 from micron_specifications ms where ms.entry_id = ${entries.id}
      and coalesce(ms.maximum_value, ms.single_value) >= ${query.micronMin}
    )`);
  }
  if (query.micronMax !== undefined) {
    conditions.push(sql`exists (
      select 1 from micron_specifications ms where ms.entry_id = ${entries.id}
      and coalesce(ms.minimum_value, ms.single_value) <= ${query.micronMax}
    )`);
  }

  const orderBy = {
    recent: [desc(entries.publishedAt)],
    oldest: [asc(entries.publishedAt)],
    rating: [desc(entries.averageRating), desc(entries.reviewCount)],
    views: [desc(entries.viewCount)],
    likes: [desc(entries.likeCount)],
    reviews: [desc(entries.reviewCount)],
    alphabetical: [asc(entries.name)],
    number: [asc(entries.publicNumber)],
  }[query.sort];

  const where = and(...conditions);
  const [rows, totalRows] = await Promise.all([
    db
      .select(publicEntrySelection())
      .from(entries)
      .innerJoin(categories, eq(entries.categoryId, categories.id))
      .leftJoin(subcategories, eq(entries.subcategoryId, subcategories.id))
      .innerJoin(users, eq(entries.originalContributorId, users.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: count() })
      .from(entries)
      .innerJoin(categories, eq(entries.categoryId, categories.id))
      .leftJoin(subcategories, eq(entries.subcategoryId, subcategories.id))
      .innerJoin(users, eq(entries.originalContributorId, users.id))
      .where(where),
  ]);

  return {
    entries: rows.map(({ primaryImagePath, ...entry }) => ({
      ...entry,
      averageRating: Number(entry.averageRating),
      primaryImageUrl: publicStorageUrl("entry-images", primaryImagePath),
    })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export async function getEntryByIdOrSlug(idOrSlug: string, viewer?: CurrentUser | null) {
  const db = getDb();
  const identifier = /^[0-9a-f-]{36}$/i.test(idOrSlug)
    ? eq(entries.id, idOrSlug)
    : eq(entries.slug, idOrSlug);
  const [row] = await db
    .select({
      ...publicEntrySelection(),
      fullDescription: entries.fullDescription,
      createdAt: entries.createdAt,
      updatedAt: entries.updatedAt,
      createdById: entries.createdById,
      originalContributorId: entries.originalContributorId,
    })
    .from(entries)
    .innerJoin(categories, eq(entries.categoryId, categories.id))
    .leftJoin(subcategories, eq(entries.subcategoryId, subcategories.id))
    .innerJoin(users, eq(entries.originalContributorId, users.id))
    .where(and(identifier, isNull(entries.deletedAt)))
    .limit(1);
  if (!row) throw notFound("Capture");
  if (
    row.status !== "PUBLISHED" &&
    (!viewer || (viewer.id !== row.createdById && !hasPermission(viewer.role, "entry:update:any")))
  ) {
    throw notFound("Capture");
  }

  const [imageRows, fieldRows, tagRows, micronRows, micronContextRows, aromaRows] =
    await Promise.all([
      db
        .select({
          id: entryImages.id,
          storagePath: entryImages.objectPath,
          altText: entryImages.altText,
          width: entryImages.width,
          height: entryImages.height,
          sortOrder: entryImages.sortOrder,
          isPrimary: entryImages.isPrimary,
          sourceUrl: entryImages.sourceUrl,
          credit: entryImages.credit,
          licenseName: entryImages.licenseName,
          licenseUrl: entryImages.licenseUrl,
        })
        .from(entryImages)
        .where(and(eq(entryImages.entryId, row.id), isNull(entryImages.deletedAt)))
        .orderBy(desc(entryImages.isPrimary), asc(entryImages.sortOrder)),
      db
        .select({
          fieldDefinitionId: entryFieldValues.fieldDefinitionId,
          value: entryFieldValues.value,
        })
        .from(entryFieldValues)
        .where(eq(entryFieldValues.entryId, row.id)),
      db
        .select({ id: tags.id, slug: tags.slug, name: tags.name })
        .from(entryTags)
        .innerJoin(tags, eq(entryTags.tagId, tags.id))
        .where(eq(entryTags.entryId, row.id)),
      db
        .select()
        .from(micronSpecifications)
        .where(eq(micronSpecifications.entryId, row.id))
        .limit(1),
      db
        .select()
        .from(entryMicronContexts)
        .where(eq(entryMicronContexts.entryId, row.id))
        .orderBy(asc(entryMicronContexts.context)),
      db
        .select({
          id: aromas.id,
          familyId: aromas.familyId,
          familyName: aromaFamilies.name,
          slug: aromas.slug,
          name: aromas.name,
          synonyms: aromas.synonyms,
          sortOrder: aromas.sortOrder,
          importance: entryAromas.importance,
          customLabel: entryAromas.customLabel,
        })
        .from(entryAromas)
        .innerJoin(aromas, eq(entryAromas.aromaId, aromas.id))
        .innerJoin(aromaFamilies, eq(aromas.familyId, aromaFamilies.id))
        .where(eq(entryAromas.entryId, row.id))
        .orderBy(asc(entryAromas.importance), asc(aromaFamilies.sortOrder), asc(aromas.sortOrder)),
    ]);
  const { primaryImagePath, createdById, originalContributorId, ...entry } = row;
  void primaryImagePath;
  void createdById;
  void originalContributorId;
  return {
    ...entry,
    averageRating: Number(entry.averageRating),
    images: imageRows.map(({ storagePath, ...image }) => ({
      ...image,
      url: publicStorageUrl("entry-images", storagePath),
    })),
    fields: Object.fromEntries(fieldRows.map((field) => [field.fieldDefinitionId, field.value])),
    tags: tagRows,
    micron: micronRows[0] ?? null,
    micronContexts: micronContextRows,
    aromas: aromaRows,
  };
}
