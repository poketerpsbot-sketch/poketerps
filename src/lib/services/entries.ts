import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, max, or } from "drizzle-orm";
import type { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import {
  auditLogs,
  categories,
  dynamicFieldDefinitions,
  entries,
  entryFieldValues,
  entryImages,
  entryRevisions,
  entryTags,
  micronSpecifications,
  submissions,
  subcategories,
  tags,
  telegramPublications,
} from "@/lib/db/schema";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import {
  finalizeEntryImagePromotion,
  prepareEntryImagePromotion,
  rollbackEntryImagePromotion,
  type EntryImagePromotion,
} from "@/lib/services/storage";
import { slugify } from "@/lib/validation/common";
import { isMicronApplicable } from "@/lib/taxonomy/measurements";
import type {
  createEntrySchema,
  moderateEntrySchema,
  updateEntrySchema,
} from "@/lib/validation/entries";

type CreateEntry = z.infer<typeof createEntrySchema>;
type UpdateEntry = z.infer<typeof updateEntrySchema>;
type ModerateEntry = z.infer<typeof moderateEntrySchema>;

function micronInsertValues(
  entryId: string,
  input: NonNullable<CreateEntry["micron"]>,
): typeof micronSpecifications.$inferInsert {
  return {
    entryId,
    mode: input.mode,
    singleValue: input.singleValue ?? null,
    minimumValue: input.minimumValue ?? null,
    maximumValue: input.maximumValue ?? null,
    multipleValues: input.multipleValues,
    displayLabel: input.displayLabel ?? null,
    sourceType: input.sourceType,
    notes: input.notes ?? null,
    isFullSpectrum: input.mode === "FULL_SPECTRUM",
    isMixedMicron: input.mode === "MIXED",
  };
}

async function validateTaxonomy(
  executor: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  categoryId: string,
  subcategoryId?: string | null,
) {
  const [category] = await executor
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.isVisible, true),
        isNull(categories.deletedAt),
      ),
    )
    .limit(1);
  if (!category) throw new AppError("INVALID_CATEGORY", "Catégorie invalide.", 400);
  let subcategorySlug: string | null = null;
  if (subcategoryId) {
    const [subcategory] = await executor
      .select({ id: subcategories.id, slug: subcategories.slug })
      .from(subcategories)
      .where(
        and(
          eq(subcategories.id, subcategoryId),
          eq(subcategories.categoryId, categoryId),
          eq(subcategories.isVisible, true),
          isNull(subcategories.deletedAt),
        ),
      )
      .limit(1);
    if (!subcategory) throw new AppError("INVALID_SUBCATEGORY", "Sous-catégorie invalide.", 400);
    subcategorySlug = subcategory.slug;
  }
  return { categorySlug: category.slug, subcategorySlug };
}

async function validateReferences(
  executor: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  input: Pick<CreateEntry, "categoryId" | "subcategoryId" | "fields" | "tagIds"> & {
    hasMicron?: boolean;
  },
) {
  const taxonomy = await validateTaxonomy(executor, input.categoryId, input.subcategoryId);
  if (input.hasMicron && !isMicronApplicable(taxonomy.categorySlug, taxonomy.subcategorySlug)) {
    throw new AppError(
      "MICRON_NOT_APPLICABLE",
      "Les microns ne s’appliquent pas à ce type de produit.",
      400,
    );
  }
  const fieldIds = Object.keys(input.fields);
  if (fieldIds.length > 0) {
    const fieldRows = await executor
      .select({
        id: dynamicFieldDefinitions.id,
        categoryId: dynamicFieldDefinitions.categoryId,
        subcategoryId: dynamicFieldDefinitions.subcategoryId,
      })
      .from(dynamicFieldDefinitions)
      .where(
        and(
          inArray(dynamicFieldDefinitions.id, fieldIds),
          eq(dynamicFieldDefinitions.isVisible, true),
          isNull(dynamicFieldDefinitions.deletedAt),
        ),
      );
    const valid = fieldRows.every(
      (field) =>
        field.categoryId === input.categoryId &&
        (field.subcategoryId === null || field.subcategoryId === (input.subcategoryId ?? null)),
    );
    if (!valid || fieldRows.length !== fieldIds.length) {
      throw new AppError(
        "INVALID_DYNAMIC_FIELDS",
        "Un ou plusieurs champs dynamiques sont invalides.",
        400,
      );
    }
  }
  if (input.tagIds.length > 0) {
    const tagRows = await executor
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.id, input.tagIds));
    if (tagRows.length !== new Set(input.tagIds).size)
      throw new AppError("INVALID_TAGS", "Tag invalide.", 400);
  }
}

export async function createEntry(input: CreateEntry, actor: CurrentUser, requestId?: string) {
  return getDb().transaction(async (tx) => {
    await validateReferences(tx, {
      ...input,
      hasMicron: Boolean(input.micron && input.micron.mode !== "NONE"),
    });
    const [entry] = await tx
      .insert(entries)
      .values({
        slug: slugify(`${input.name}-${randomUUID().slice(0, 8)}`),
        name: input.name,
        shortDescription: input.shortDescription ?? null,
        fullDescription: input.fullDescription ?? null,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId ?? null,
        rarity: input.rarity,
        status: "DRAFT",
        createdById: actor.id,
        originalContributorId: actor.id,
      })
      .returning();
    if (!entry) throw new AppError("ENTRY_CREATE_FAILED", "Création impossible.", 500);

    const fieldValues = Object.entries(input.fields).map(([fieldDefinitionId, value]) => ({
      entryId: entry.id,
      fieldDefinitionId,
      value,
    }));
    if (fieldValues.length > 0) await tx.insert(entryFieldValues).values(fieldValues);
    if (input.tagIds.length > 0) {
      await tx
        .insert(entryTags)
        .values([...new Set(input.tagIds)].map((tagId) => ({ entryId: entry.id, tagId })));
    }
    if (input.micron) {
      await tx.insert(micronSpecifications).values(micronInsertValues(entry.id, input.micron));
    }
    await tx.insert(entryRevisions).values({
      entryId: entry.id,
      revisionNumber: 1,
      snapshot: input,
      changeSummary: "Création du brouillon",
      changedById: actor.id,
    });
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "ENTRY_CREATED",
        entityType: "ENTRY",
        entityId: entry.id,
        requestId,
        after: { status: entry.status, name: entry.name, categoryId: entry.categoryId },
      }),
    );
    return {
      id: entry.id,
      publicNumber: entry.publicNumber,
      slug: entry.slug,
      status: entry.status,
    };
  });
}

export async function updateEntry(
  id: string,
  input: UpdateEntry,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Capture");
    if (existing.createdById !== actor.id && !hasPermission(actor.role, "entry:update:any"))
      throw forbidden();
    if (
      ["PUBLISHED", "APPROVED", "ARCHIVED"].includes(existing.status) &&
      !hasPermission(actor.role, "entry:update:any")
    ) {
      throw conflict(
        "Une fiche publiée doit être corrigée via une proposition.",
        "CORRECTION_REQUIRED",
      );
    }

    const categoryId = input.categoryId ?? existing.categoryId;
    const subcategoryId =
      input.subcategoryId === undefined ? existing.subcategoryId : input.subcategoryId;
    if (
      input.categoryId !== undefined ||
      input.subcategoryId !== undefined ||
      input.fields ||
      input.tagIds ||
      input.micron !== undefined
    ) {
      let hasMicron = Boolean(input.micron && input.micron.mode !== "NONE");
      if (
        input.micron === undefined &&
        (input.categoryId !== undefined || input.subcategoryId !== undefined)
      ) {
        const [existingMicron] = await tx
          .select({ entryId: micronSpecifications.entryId })
          .from(micronSpecifications)
          .where(eq(micronSpecifications.entryId, id))
          .limit(1);
        hasMicron = Boolean(existingMicron);
      }
      await validateReferences(tx, {
        categoryId,
        subcategoryId,
        fields: input.fields ?? {},
        tagIds: input.tagIds ?? [],
        hasMicron,
      });
    }
    const set: Partial<typeof entries.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    if (input.shortDescription !== undefined) set.shortDescription = input.shortDescription;
    if (input.fullDescription !== undefined) set.fullDescription = input.fullDescription;
    if (input.categoryId !== undefined) set.categoryId = input.categoryId;
    if (input.subcategoryId !== undefined) set.subcategoryId = input.subcategoryId;
    if (input.rarity !== undefined) set.rarity = input.rarity;
    const [updated] = await tx.update(entries).set(set).where(eq(entries.id, id)).returning();

    if (input.fields) {
      await tx.delete(entryFieldValues).where(eq(entryFieldValues.entryId, id));
      const values = Object.entries(input.fields).map(([fieldDefinitionId, value]) => ({
        entryId: id,
        fieldDefinitionId,
        value,
      }));
      if (values.length > 0) await tx.insert(entryFieldValues).values(values);
    }
    if (input.tagIds) {
      await tx.delete(entryTags).where(eq(entryTags.entryId, id));
      if (input.tagIds.length > 0) {
        await tx
          .insert(entryTags)
          .values([...new Set(input.tagIds)].map((tagId) => ({ entryId: id, tagId })));
      }
    }
    if (input.micron !== undefined) {
      await tx.delete(micronSpecifications).where(eq(micronSpecifications.entryId, id));
      if (input.micron) {
        await tx.insert(micronSpecifications).values(micronInsertValues(id, input.micron));
      }
    }
    const [revision] = await tx
      .select({ value: max(entryRevisions.revisionNumber) })
      .from(entryRevisions)
      .where(eq(entryRevisions.entryId, id));
    await tx.insert(entryRevisions).values({
      entryId: id,
      revisionNumber: Number(revision?.value ?? 0) + 1,
      snapshot: input,
      changeSummary: "Mise à jour du brouillon",
      changedById: actor.id,
    });
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "ENTRY_UPDATED",
        entityType: "ENTRY",
        entityId: id,
        requestId,
        before: { status: existing.status, name: existing.name, categoryId: existing.categoryId },
        after: { status: updated?.status, name: updated?.name, categoryId: updated?.categoryId },
      }),
    );
    return { id, slug: updated?.slug ?? existing.slug, status: updated?.status ?? existing.status };
  });
}

export async function submitEntry(
  id: string,
  actor: CurrentUser,
  note?: string,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
      .limit(1)
      .for("update");
    if (!entry) throw notFound("Capture");
    if (entry.createdById !== actor.id && !hasPermission(actor.role, "entry:update:any"))
      throw forbidden();
    if (!(["DRAFT", "CHANGES_REQUESTED"] as string[]).includes(entry.status)) {
      throw conflict(
        "Cette capture ne peut pas être envoyée dans son état actuel.",
        "INVALID_STATUS_TRANSITION",
      );
    }
    const requiredFields = await tx
      .select({ id: dynamicFieldDefinitions.id })
      .from(dynamicFieldDefinitions)
      .where(
        and(
          eq(dynamicFieldDefinitions.categoryId, entry.categoryId),
          eq(dynamicFieldDefinitions.isVisible, true),
          isNull(dynamicFieldDefinitions.deletedAt),
          eq(dynamicFieldDefinitions.isRequired, true),
          entry.subcategoryId
            ? or(
                isNull(dynamicFieldDefinitions.subcategoryId),
                eq(dynamicFieldDefinitions.subcategoryId, entry.subcategoryId),
              )
            : isNull(dynamicFieldDefinitions.subcategoryId),
        ),
      );
    if (requiredFields.length > 0) {
      const values = await tx
        .select({ fieldDefinitionId: entryFieldValues.fieldDefinitionId })
        .from(entryFieldValues)
        .where(
          and(
            eq(entryFieldValues.entryId, id),
            inArray(
              entryFieldValues.fieldDefinitionId,
              requiredFields.map((field) => field.id),
            ),
          ),
        );
      if (values.length !== requiredFields.length) {
        throw new AppError(
          "MISSING_REQUIRED_FIELDS",
          "Des champs obligatoires sont manquants.",
          400,
          {
            details: {
              fieldIds: requiredFields
                .filter((field) => !values.some((value) => value.fieldDefinitionId === field.id))
                .map((field) => field.id),
            },
          },
        );
      }
    }
    await tx
      .update(entries)
      .set({ status: "PENDING_REVIEW", updatedAt: new Date() })
      .where(eq(entries.id, id));
    const [submission] = await tx
      .insert(submissions)
      .values({
        type: "NEW_ENTRY",
        entryId: id,
        userId: actor.id,
        title: entry.name,
        message: note ?? null,
        status: "PENDING_REVIEW",
        payload: note ? { note } : {},
        submittedAt: new Date(),
      })
      .returning({ id: submissions.id });
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "ENTRY_SUBMITTED",
        entityType: "ENTRY",
        entityId: id,
        requestId,
        before: { status: entry.status },
        after: { status: "PENDING_REVIEW", submissionId: submission?.id },
      }),
    );
    return { id, status: "PENDING_REVIEW" as const, submissionId: submission?.id };
  });
}

const allowedTransitions: Record<string, readonly string[]> = {
  PENDING_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "REJECTED"],
  CHANGES_REQUESTED: ["PENDING_REVIEW", "REJECTED"],
  APPROVED: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["HIDDEN", "ARCHIVED"],
  HIDDEN: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: ["PUBLISHED"],
};

export async function moderateEntry(
  id: string,
  input: ModerateEntry,
  actor: CurrentUser,
  requestId?: string,
) {
  let promotion: EntryImagePromotion | undefined;
  let result: { id: string; status: ModerateEntry["status"] };
  try {
    result = await getDb().transaction(async (tx) => {
      const [entry] = await tx
        .select()
        .from(entries)
        .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
        .limit(1)
        .for("update");
      if (!entry) throw notFound("Capture");
      if (!allowedTransitions[entry.status]?.includes(input.status)) {
        throw conflict("Transition de statut invalide.", "INVALID_STATUS_TRANSITION");
      }

      if (input.status === "PUBLISHED") {
        const privateImages = await tx
          .select({ objectPath: entryImages.objectPath, mimeType: entryImages.mimeType })
          .from(entryImages)
          .where(
            and(
              eq(entryImages.entryId, id),
              eq(entryImages.storageBucket, "entry-drafts"),
              isNull(entryImages.deletedAt),
            ),
          )
          .for("update");
        if (privateImages.length > 0) {
          const [conflictingPublicImage] = await tx
            .select({ id: entryImages.id })
            .from(entryImages)
            .where(
              and(
                eq(entryImages.storageBucket, "entry-images"),
                inArray(
                  entryImages.objectPath,
                  privateImages.map((image) => image.objectPath),
                ),
                isNull(entryImages.deletedAt),
              ),
            )
            .limit(1)
            .for("update");
          if (conflictingPublicImage) {
            throw new AppError(
              "STORAGE_PROMOTION_CONFLICT",
              "Une image publique utilise déjà cette destination.",
              409,
            );
          }
        }
        promotion = await prepareEntryImagePromotion(privateImages);
        if (promotion.paths.length > 0) {
          await tx
            .update(entryImages)
            .set({ storageBucket: "entry-images" })
            .where(
              and(
                eq(entryImages.entryId, id),
                eq(entryImages.storageBucket, "entry-drafts"),
                isNull(entryImages.deletedAt),
              ),
            );
        }
      }

      const now = new Date();
      const set: Partial<typeof entries.$inferInsert> = { status: input.status, updatedAt: now };
      if (input.status === "APPROVED" || input.status === "PUBLISHED") {
        set.approvedById = actor.id;
        set.approvedAt = entry.approvedAt ?? now;
      }
      if (input.status === "PUBLISHED") {
        set.publishedById = actor.id;
        set.publishedAt = entry.publishedAt ?? now;
        set.archivedAt = null;
      }
      if (input.status === "ARCHIVED") set.archivedAt = now;
      await tx.update(entries).set(set).where(eq(entries.id, id));
      const submissionStatus =
        input.status === "CHANGES_REQUESTED"
          ? "CHANGES_REQUESTED"
          : input.status === "APPROVED" || input.status === "PUBLISHED"
            ? "APPROVED"
            : input.status === "REJECTED"
              ? "REJECTED"
              : undefined;
      if (submissionStatus) {
        await tx
          .update(submissions)
          .set({
            status: submissionStatus,
            reviewReason: input.reason ?? null,
            reviewedById: actor.id,
            reviewedAt: now,
            updatedAt: now,
          })
          .where(and(eq(submissions.entryId, id), eq(submissions.status, "PENDING_REVIEW")));
      }

      if (input.status === "PUBLISHED") {
        const preview = `🌿 Nouvelle capture #${String(entry.publicNumber).padStart(4, "0")}\n\n${entry.name}`;
        await tx.insert(telegramPublications).values({
          type: "ENTRY",
          entryId: id,
          status: "DRAFT",
          previewPayload: { text: preview },
          createdById: actor.id,
        });
      }
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: `ENTRY_${input.status}`,
          entityType: "ENTRY",
          entityId: id,
          requestId,
          before: { status: entry.status },
          after: { status: input.status, reason: input.reason },
        }),
      );
      return { id, status: input.status };
    });
  } catch (error) {
    if (promotion) await rollbackEntryImagePromotion(promotion);
    throw error;
  }
  if (promotion) await finalizeEntryImagePromotion(promotion);
  return result;
}

export async function softDeleteEntry(id: string, actor: CurrentUser, requestId?: string) {
  return getDb().transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
      .limit(1)
      .for("update");
    if (!entry) throw notFound("Capture");
    if (entry.createdById !== actor.id && !hasPermission(actor.role, "entry:update:any"))
      throw forbidden();
    if (entry.status === "PUBLISHED" && !hasPermission(actor.role, "entry:moderate"))
      throw forbidden();
    await tx
      .update(entries)
      .set({ status: "DELETED", deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(entries.id, id));
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "ENTRY_DELETED",
        entityType: "ENTRY",
        entityId: id,
        requestId,
        before: { status: entry.status },
        after: { status: "DELETED" },
      }),
    );
  });
}
