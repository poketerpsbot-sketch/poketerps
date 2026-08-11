import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { auditLogs, partnerCategories, partnerClickEvents, partners } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import { publicStorageUrl } from "@/lib/services/storage-url";
import { slugify } from "@/lib/validation/common";
import type {
  partnerInputSchema,
  partnerQuerySchema,
  updatePartnerSchema,
} from "@/lib/validation/partners";

type PartnerInput = z.infer<typeof partnerInputSchema>;
type PartnerUpdate = z.infer<typeof updatePartnerSchema>;
type PartnerQuery = z.infer<typeof partnerQuerySchema>;

const partnerSelection = {
  id: partners.id,
  slug: partners.slug,
  name: partners.name,
  description: partners.description,
  logoBucket: partners.logoBucket,
  logoPath: partners.logoPath,
  coverBucket: partners.coverBucket,
  coverPath: partners.coverPath,
  websiteUrl: partners.websiteUrl,
  telegramUrl: partners.telegramUrl,
  instagramUrl: partners.instagramUrl,
  otherUrl: partners.otherUrl,
  isActive: partners.isActive,
  isFeatured: partners.isFeatured,
  sortOrder: partners.sortOrder,
  featuredFrom: partners.featuredFrom,
  featuredUntil: partners.featuredUntil,
  createdAt: partners.createdAt,
  category: {
    id: partnerCategories.id,
    slug: partnerCategories.slug,
    name: partnerCategories.name,
    kind: partnerCategories.kind,
  },
};

function toPartnerDto<
  T extends {
    logoBucket: string | null;
    logoPath: string | null;
    coverBucket: string | null;
    coverPath: string | null;
  },
>(partner: T) {
  const { logoBucket, logoPath, coverBucket, coverPath, ...rest } = partner;
  return {
    ...rest,
    logoUrl: publicStorageUrl(logoBucket ?? "partner-images", logoPath),
    coverUrl: publicStorageUrl(coverBucket ?? "partner-images", coverPath),
  };
}

export async function listPartners(query: PartnerQuery) {
  const conditions = [isNull(partners.deletedAt)];
  if (!query.includeInactive) conditions.push(eq(partners.isActive, true));
  if (query.featured !== undefined) conditions.push(eq(partners.isFeatured, query.featured));
  const where = and(...conditions);
  const db = getDb();
  const [rows, totalRows] = await Promise.all([
    db
      .select(partnerSelection)
      .from(partners)
      .leftJoin(partnerCategories, eq(partners.categoryId, partnerCategories.id))
      .where(where)
      .orderBy(desc(partners.isFeatured), asc(partners.sortOrder), asc(partners.name))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(partners).where(where),
  ]);
  return { partners: rows.map(toPartnerDto), total: Number(totalRows[0]?.total ?? 0) };
}

export async function getPartnerBySlug(slug: string) {
  const [partner] = await getDb()
    .select(partnerSelection)
    .from(partners)
    .leftJoin(partnerCategories, eq(partners.categoryId, partnerCategories.id))
    .where(and(eq(partners.slug, slug), eq(partners.isActive, true), isNull(partners.deletedAt)))
    .limit(1);
  if (!partner) throw notFound("Partenaire");
  return toPartnerDto(partner);
}

export async function createPartner(input: PartnerInput, actor: CurrentUser, requestId?: string) {
  return getDb().transaction(async (tx) => {
    const [category] = input.categoryId
      ? await tx
          .select({ id: partnerCategories.id })
          .from(partnerCategories)
          .where(
            and(eq(partnerCategories.id, input.categoryId), eq(partnerCategories.isActive, true)),
          )
          .limit(1)
      : await tx
          .select({ id: partnerCategories.id })
          .from(partnerCategories)
          .where(eq(partnerCategories.isActive, true))
          .orderBy(asc(partnerCategories.sortOrder), asc(partnerCategories.name))
          .limit(1);
    if (!category)
      throw new AppError("INVALID_PARTNER_CATEGORY", "Catégorie partenaire invalide.", 400);
    const [partner] = await tx
      .insert(partners)
      .values({
        name: input.name,
        categoryId: category.id,
        logoPath: input.logoPath ?? null,
        logoBucket: input.logoPath ? "partner-images" : null,
        coverPath: input.coverPath ?? null,
        coverBucket: input.coverPath ? "partner-images" : null,
        description: input.description ?? null,
        websiteUrl: input.websiteUrl ?? null,
        telegramUrl: input.telegramUrl ?? null,
        instagramUrl: input.instagramUrl ?? null,
        otherUrl: input.otherUrl ?? null,
        featuredFrom: input.featuredFrom ? new Date(input.featuredFrom) : null,
        featuredUntil: input.featuredUntil ? new Date(input.featuredUntil) : null,
        isActive: input.isActive,
        isFeatured: input.isFeatured,
        sortOrder: input.sortOrder,
        slug: slugify(`${input.name}-${randomUUID().slice(0, 8)}`),
      })
      .returning({ id: partners.id, slug: partners.slug, name: partners.name });
    if (!partner) throw new Error("Partner insert failed");
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "PARTNER_CREATED",
        entityType: "PARTNER",
        entityId: partner.id,
        source: "WEB_ADMIN",
        requestId,
        after: partner,
      }),
    );
    return partner;
  });
}

export async function updatePartner(
  id: string,
  input: PartnerUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), isNull(partners.deletedAt)))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Partenaire");
    const { categoryId, ...inputWithoutCategory } = input;
    const values: Partial<typeof partners.$inferInsert> = {
      ...inputWithoutCategory,
      updatedAt: new Date(),
      featuredFrom:
        input.featuredFrom === undefined
          ? undefined
          : input.featuredFrom
            ? new Date(input.featuredFrom)
            : null,
      featuredUntil:
        input.featuredUntil === undefined
          ? undefined
          : input.featuredUntil
            ? new Date(input.featuredUntil)
            : null,
    };
    if (categoryId) values.categoryId = categoryId;
    if (input.logoPath !== undefined) values.logoBucket = input.logoPath ? "partner-images" : null;
    if (input.coverPath !== undefined)
      values.coverBucket = input.coverPath ? "partner-images" : null;
    const [updated] = await tx.update(partners).set(values).where(eq(partners.id, id)).returning({
      id: partners.id,
      slug: partners.slug,
      name: partners.name,
      isActive: partners.isActive,
      isFeatured: partners.isFeatured,
    });
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "PARTNER_UPDATED",
        entityType: "PARTNER",
        entityId: id,
        source: "WEB_ADMIN",
        requestId,
        before: {
          name: existing.name,
          isActive: existing.isActive,
          isFeatured: existing.isFeatured,
        },
        after: updated,
      }),
    );
    return updated;
  });
}

export async function softDeletePartner(id: string, actor: CurrentUser, requestId?: string) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), isNull(partners.deletedAt)))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Partenaire");
    await tx
      .update(partners)
      .set({ isActive: false, isFeatured: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(partners.id, id));
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "PARTNER_DELETED",
        entityType: "PARTNER",
        entityId: id,
        source: "WEB_ADMIN",
        requestId,
        before: { name: existing.name, isActive: existing.isActive },
        after: { isActive: false, deleted: true },
      }),
    );
  });
}

export async function recordPartnerClick(
  partnerId: string,
  target: "website" | "telegram" | "instagram" | "other",
  viewer: { userId?: string | null; anonymousSessionHash?: string | null },
) {
  const [partner] = await getDb()
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.id, partnerId), eq(partners.isActive, true), isNull(partners.deletedAt)))
    .limit(1);
  if (!partner) throw notFound("Partenaire");
  await getDb()
    .insert(partnerClickEvents)
    .values({
      partnerId,
      userId: viewer.userId ?? null,
      anonymousSessionHash: viewer.anonymousSessionHash ?? null,
      linkType: target.toUpperCase(),
    });
}
