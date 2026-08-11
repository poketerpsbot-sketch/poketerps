import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, max, or } from "drizzle-orm";
import type { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import {
  auditLogs,
  categories,
  dynamicFieldDefinitions,
  dynamicFieldOptions,
  entries,
  entryFieldValues,
  entryImages,
  entryMicronContexts,
  entryRevisions,
  entryTags,
  micronSpecifications,
  micronPresets,
  submissions,
  subcategoryMicronPresets,
  subcategories,
  tags,
  telegramPublications,
  users,
} from "@/lib/db/schema";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { auditValues, type AuditSource } from "@/lib/services/audit";
import { createUserNotification, sendEntryStatusTelegram } from "@/lib/services/notifications";
import {
  finalizeEntryImagePromotion,
  prepareEntryImagePromotion,
  rollbackEntryImagePromotion,
  removeEntryStorageObjects,
  type EntryImagePromotion,
} from "@/lib/services/storage";
import { slugify } from "@/lib/validation/common";
import type {
  createEntrySchema,
  moderateEntrySchema,
  updateEntrySchema,
} from "@/lib/validation/entries";

type CreateEntry = z.infer<typeof createEntrySchema>;
type UpdateEntry = z.infer<typeof updateEntrySchema>;
type ModerateEntry = z.infer<typeof moderateEntrySchema>;

function isEmptyDynamicFieldValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function validateDynamicFieldValue(
  field: {
    label: string;
    fieldType: string;
    validationRules: Record<string, unknown>;
  },
  value: CreateEntry["fields"][string],
  allowedOptions: Set<string>,
) {
  if (value === null) return;
  const invalid = () =>
    new AppError(
      "INVALID_DYNAMIC_FIELD_VALUE",
      `La valeur du champ « ${field.label} » est invalide.`,
      400,
    );
  if (field.fieldType === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw invalid();
    const minimum = field.validationRules.min;
    const maximum = field.validationRules.max;
    if (typeof minimum === "number" && value < minimum) throw invalid();
    if (typeof maximum === "number" && value > maximum) throw invalid();
    return;
  }
  if (field.fieldType === "BOOLEAN") {
    if (typeof value !== "boolean") throw invalid();
    return;
  }
  if (field.fieldType === "MULTI_SELECT") {
    if (!Array.isArray(value) || value.some((option) => !allowedOptions.has(option))) {
      throw invalid();
    }
    return;
  }
  if (field.fieldType === "SELECT") {
    if (typeof value !== "string" || !allowedOptions.has(value)) throw invalid();
    return;
  }
  if (typeof value !== "string") throw invalid();
  if (field.fieldType === "URL") {
    try {
      if (!new URL(value).protocol.match(/^https?:$/)) throw invalid();
    } catch {
      throw invalid();
    }
  }
  if (field.fieldType === "DATE" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid();
}

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

function micronContextInsertValues(
  entryId: string,
  input: CreateEntry["micronContexts"][number],
): typeof entryMicronContexts.$inferInsert {
  return {
    entryId,
    context: input.context,
    mode: input.mode,
    singleValue: input.singleValue ?? null,
    minimumValue: input.minimumValue ?? null,
    maximumValue: input.maximumValue ?? null,
    multipleValues: input.multipleValues.length ? input.multipleValues : null,
    displayLabel: input.displayLabel ?? null,
    sourceType: input.sourceType,
    notes: input.notes ?? null,
    isFullSpectrum: input.mode === "FULL_SPECTRUM",
    isMixedMicron: input.mode === "MIXED",
  };
}

function micronValuesEqual(left: MicronValue, right: MicronValue): boolean {
  return (
    left.mode === right.mode &&
    left.singleValue === right.singleValue &&
    left.minimumValue === right.minimumValue &&
    left.maximumValue === right.maximumValue &&
    JSON.stringify(sortedValues(left.multipleValues)) ===
      JSON.stringify(sortedValues(right.multipleValues))
  );
}

function legacyMicronFromContext(
  value: CreateEntry["micronContexts"][number],
): NonNullable<CreateEntry["micron"]> {
  return {
    mode: value.mode,
    singleValue: value.singleValue,
    minimumValue: value.minimumValue,
    maximumValue: value.maximumValue,
    multipleValues: value.multipleValues,
    displayLabel: value.displayLabel,
    sourceType: value.sourceType,
    notes: value.notes,
  };
}

function collectionContextFromLegacy(
  value: NonNullable<CreateEntry["micron"]>,
): CreateEntry["micronContexts"][number] {
  return { ...value, context: "COLLECTION_SEPARATION" };
}

export function assertExplicitMicronConsistency(
  micron: CreateEntry["micron"],
  contexts: CreateEntry["micronContexts"],
) {
  const collection = contexts.find(
    (value) => value.context === "COLLECTION_SEPARATION" && value.mode !== "NONE",
  );
  const legacy = micron && micron.mode !== "NONE" ? micron : null;
  if (
    Boolean(collection) !== Boolean(legacy) ||
    (collection && legacy && !micronValuesEqual(collection, legacy))
  ) {
    throw new AppError(
      "INCONSISTENT_MICRON_VALUES",
      "La fraction de collecte doit être identique dans les deux représentations micron.",
      400,
    );
  }
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
  let subcategoryConfig: {
    id: string;
    slug: string;
    micronRequirement: "ABSENT" | "OPTIONAL" | "REQUIRED";
    allowedMicronContexts: Array<"COLLECTION_SEPARATION" | "PRESSING_BAG">;
  } | null = null;
  if (subcategoryId) {
    const [subcategory] = await executor
      .select({
        id: subcategories.id,
        slug: subcategories.slug,
        micronRequirement: subcategories.micronRequirement,
        allowedMicronContexts: subcategories.allowedMicronContexts,
      })
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
    subcategoryConfig = subcategory;
  }
  return { categorySlug: category.slug, subcategory: subcategoryConfig };
}

type MicronValue = NonNullable<CreateEntry["micron"]> | CreateEntry["micronContexts"][number];

function sortedValues(values: number[] | null | undefined): number[] {
  return [...(values ?? [])].sort((left, right) => left - right);
}

function micronMatchesPreset(
  value: MicronValue,
  preset: Pick<
    typeof micronPresets.$inferSelect,
    "mode" | "singleValue" | "minimumValue" | "maximumValue" | "multipleValues"
  >,
) {
  if (value.mode !== preset.mode) return false;
  if (value.mode === "SINGLE") return value.singleValue === preset.singleValue;
  if (value.mode === "RANGE") {
    return value.minimumValue === preset.minimumValue && value.maximumValue === preset.maximumValue;
  }
  if (value.mode === "MULTIPLE") {
    return (
      JSON.stringify(sortedValues(value.multipleValues)) ===
      JSON.stringify(sortedValues(preset.multipleValues))
    );
  }
  return value.mode === "FULL_SPECTRUM" || value.mode === "MIXED" || value.mode === "NONE";
}

async function validateReferences(
  executor: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  input: Pick<CreateEntry, "categoryId" | "subcategoryId" | "fields" | "tagIds"> & {
    micron?: CreateEntry["micron"];
    micronContexts?: CreateEntry["micronContexts"];
  },
) {
  const taxonomy = await validateTaxonomy(executor, input.categoryId, input.subcategoryId);
  const allowedContexts = new Set(taxonomy.subcategory?.allowedMicronContexts ?? []);
  if (taxonomy.subcategory?.micronRequirement === "ABSENT") allowedContexts.clear();
  const requestedContexts = new Set(
    (input.micronContexts ?? [])
      .filter((value) => value.mode !== "NONE")
      .map((value) => value.context),
  );
  if (input.micron && input.micron.mode !== "NONE") requestedContexts.add("COLLECTION_SEPARATION");
  if ([...requestedContexts].some((context) => !allowedContexts.has(context))) {
    throw new AppError(
      "MICRON_NOT_APPLICABLE",
      "Ce contexte micron ne s’applique pas à ce type de produit.",
      400,
    );
  }
  const suppliedValues = [
    ...(input.micronContexts ?? []).filter((value) => value.mode !== "NONE"),
    ...(!input.micronContexts?.some((value) => value.context === "COLLECTION_SEPARATION") &&
    input.micron &&
    input.micron.mode !== "NONE"
      ? [{ ...input.micron, context: "COLLECTION_SEPARATION" as const }]
      : []),
  ];
  if (
    taxonomy.subcategory?.micronRequirement === "REQUIRED" &&
    [...allowedContexts].some(
      (context) => !suppliedValues.some((value) => value.context === context),
    )
  ) {
    throw new AppError("MICRON_REQUIRED", "Les microns requis ne sont pas renseignés.", 400);
  }
  if (suppliedValues.length && taxonomy.subcategory) {
    const presetRows = await executor
      .select({
        context: micronPresets.context,
        slug: micronPresets.slug,
        mode: micronPresets.mode,
        singleValue: micronPresets.singleValue,
        minimumValue: micronPresets.minimumValue,
        maximumValue: micronPresets.maximumValue,
        multipleValues: micronPresets.multipleValues,
        isFullSpectrum: micronPresets.isFullSpectrum,
        isMixedMicron: micronPresets.isMixedMicron,
      })
      .from(subcategoryMicronPresets)
      .innerJoin(micronPresets, eq(subcategoryMicronPresets.micronPresetId, micronPresets.id))
      .where(
        and(
          eq(subcategoryMicronPresets.subcategoryId, taxonomy.subcategory.id),
          eq(micronPresets.isActive, true),
        ),
      );
    for (const value of suppliedValues) {
      const applicable = presetRows.filter((preset) => preset.context === value.context);
      const customAllowed =
        applicable.some((preset) => preset.slug.includes("custom")) &&
        ((value.context === "COLLECTION_SEPARATION" && value.mode === "RANGE") ||
          (value.context === "PRESSING_BAG" && value.mode === "SINGLE"));
      if (!customAllowed && !applicable.some((preset) => micronMatchesPreset(value, preset))) {
        throw new AppError(
          "MICRON_PRESET_NOT_ALLOWED",
          "Cette valeur micron n’est pas autorisée pour la sous-catégorie.",
          400,
        );
      }
    }
  }
  const fieldIds = Object.keys(input.fields);
  if (fieldIds.length > 0) {
    const fieldRows = await executor
      .select({
        id: dynamicFieldDefinitions.id,
        categoryId: dynamicFieldDefinitions.categoryId,
        subcategoryId: dynamicFieldDefinitions.subcategoryId,
        label: dynamicFieldDefinitions.label,
        fieldType: dynamicFieldDefinitions.fieldType,
        validationRules: dynamicFieldDefinitions.validationRules,
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
    const optionRows = await executor
      .select({
        fieldDefinitionId: dynamicFieldOptions.fieldDefinitionId,
        value: dynamicFieldOptions.value,
      })
      .from(dynamicFieldOptions)
      .where(
        and(
          inArray(dynamicFieldOptions.fieldDefinitionId, fieldIds),
          eq(dynamicFieldOptions.isActive, true),
        ),
      );
    const optionsByField = new Map<string, Set<string>>();
    for (const option of optionRows) {
      const values = optionsByField.get(option.fieldDefinitionId) ?? new Set<string>();
      values.add(option.value);
      optionsByField.set(option.fieldDefinitionId, values);
    }
    for (const field of fieldRows) {
      validateDynamicFieldValue(
        field,
        input.fields[field.id],
        optionsByField.get(field.id) ?? new Set(),
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
    const collectionContext = input.micronContexts.find(
      (value) => value.context === "COLLECTION_SEPARATION" && value.mode !== "NONE",
    );
    if (collectionContext && input.micron && !micronValuesEqual(collectionContext, input.micron)) {
      throw new AppError(
        "INCONSISTENT_MICRON_VALUES",
        "La fraction de collecte doit être identique dans les deux représentations micron.",
        400,
      );
    }
    const normalizedMicron = collectionContext
      ? legacyMicronFromContext(collectionContext)
      : input.micron;
    const normalizedMicronContexts = [...input.micronContexts];
    if (!collectionContext && normalizedMicron && normalizedMicron.mode !== "NONE") {
      normalizedMicronContexts.push(collectionContextFromLegacy(normalizedMicron));
    }
    await validateReferences(tx, {
      ...input,
      micron: normalizedMicron,
      micronContexts: normalizedMicronContexts,
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
    if (normalizedMicron) {
      await tx.insert(micronSpecifications).values(micronInsertValues(entry.id, normalizedMicron));
    }
    const contextValues = normalizedMicronContexts
      .filter((value) => value.mode !== "NONE")
      .map((value) => micronContextInsertValues(entry.id, value));
    if (contextValues.length > 0) await tx.insert(entryMicronContexts).values(contextValues);
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
        source: "API",
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
      !hasPermission(actor.role, "entry:update:any") &&
      !["DRAFT", "CHANGES_REQUESTED"].includes(existing.status)
    ) {
      throw conflict(
        "Cette fiche doit être corrigée via une proposition ou une demande de modification.",
        "CORRECTION_REQUIRED",
      );
    }

    const categoryId = input.categoryId ?? existing.categoryId;
    const subcategoryId =
      input.subcategoryId === undefined ? existing.subcategoryId : input.subcategoryId;
    const shouldValidateReferences =
      input.categoryId !== undefined ||
      input.subcategoryId !== undefined ||
      input.fields ||
      input.tagIds ||
      input.micron !== undefined ||
      input.micronContexts !== undefined;
    let micronUpdate = input.micron;
    let micronContextsUpdate = input.micronContexts;
    if (shouldValidateReferences) {
      const [[storedMicron], storedContexts] = await Promise.all([
        tx
          .select({
            mode: micronSpecifications.mode,
            singleValue: micronSpecifications.singleValue,
            minimumValue: micronSpecifications.minimumValue,
            maximumValue: micronSpecifications.maximumValue,
            multipleValues: micronSpecifications.multipleValues,
            displayLabel: micronSpecifications.displayLabel,
            sourceType: micronSpecifications.sourceType,
            notes: micronSpecifications.notes,
          })
          .from(micronSpecifications)
          .where(eq(micronSpecifications.entryId, id))
          .limit(1),
        tx
          .select({
            context: entryMicronContexts.context,
            mode: entryMicronContexts.mode,
            singleValue: entryMicronContexts.singleValue,
            minimumValue: entryMicronContexts.minimumValue,
            maximumValue: entryMicronContexts.maximumValue,
            multipleValues: entryMicronContexts.multipleValues,
            displayLabel: entryMicronContexts.displayLabel,
            sourceType: entryMicronContexts.sourceType,
            notes: entryMicronContexts.notes,
          })
          .from(entryMicronContexts)
          .where(eq(entryMicronContexts.entryId, id)),
      ]);
      const existingMicron: CreateEntry["micron"] = storedMicron
        ? {
            ...storedMicron,
            multipleValues: storedMicron.multipleValues ?? [],
            sourceType:
              storedMicron.sourceType === "LABEL" ? ("DECLARED" as const) : storedMicron.sourceType,
          }
        : null;
      const existingContexts: CreateEntry["micronContexts"] = storedContexts.map((value) => ({
        ...value,
        multipleValues: value.multipleValues ?? [],
        sourceType: value.sourceType === "LABEL" ? ("DECLARED" as const) : value.sourceType,
      }));
      if (input.micron !== undefined && input.micronContexts !== undefined) {
        assertExplicitMicronConsistency(input.micron, input.micronContexts);
      }
      let micron = input.micron === undefined ? existingMicron : input.micron;
      let micronContexts =
        input.micronContexts === undefined ? existingContexts : input.micronContexts;
      if (input.micronContexts !== undefined) {
        const collection = input.micronContexts.find(
          (value) => value.context === "COLLECTION_SEPARATION" && value.mode !== "NONE",
        );
        micron = collection ? legacyMicronFromContext(collection) : null;
        micronUpdate = micron;
      } else if (input.micron !== undefined) {
        micronContexts = existingContexts.filter(
          (value) => value.context !== "COLLECTION_SEPARATION",
        );
        if (input.micron && input.micron.mode !== "NONE") {
          micronContexts.push(collectionContextFromLegacy(input.micron));
        }
        micronContextsUpdate = micronContexts;
      }
      let fields = input.fields ?? {};
      if (
        input.fields === undefined &&
        (input.categoryId !== undefined || input.subcategoryId !== undefined)
      ) {
        const storedFields = await tx
          .select({
            fieldDefinitionId: entryFieldValues.fieldDefinitionId,
            value: entryFieldValues.value,
          })
          .from(entryFieldValues)
          .where(eq(entryFieldValues.entryId, id));
        fields = Object.fromEntries(
          storedFields.map((field) => [
            field.fieldDefinitionId,
            field.value as CreateEntry["fields"][string],
          ]),
        );
      }
      await validateReferences(tx, {
        categoryId,
        subcategoryId,
        fields,
        tagIds: input.tagIds ?? [],
        micron,
        micronContexts,
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
    if (micronUpdate !== undefined) {
      await tx.delete(micronSpecifications).where(eq(micronSpecifications.entryId, id));
      if (micronUpdate) {
        await tx.insert(micronSpecifications).values(micronInsertValues(id, micronUpdate));
      }
    }
    if (micronContextsUpdate !== undefined) {
      await tx.delete(entryMicronContexts).where(eq(entryMicronContexts.entryId, id));
      const contextValues = micronContextsUpdate
        .filter((value) => value.mode !== "NONE")
        .map((value) => micronContextInsertValues(id, value));
      if (contextValues.length > 0) await tx.insert(entryMicronContexts).values(contextValues);
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
        source: "API",
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
    const [storedFields, [storedMicron], storedContexts, storedTags] = await Promise.all([
      tx
        .select({
          fieldDefinitionId: entryFieldValues.fieldDefinitionId,
          value: entryFieldValues.value,
        })
        .from(entryFieldValues)
        .where(eq(entryFieldValues.entryId, id)),
      tx
        .select({
          mode: micronSpecifications.mode,
          singleValue: micronSpecifications.singleValue,
          minimumValue: micronSpecifications.minimumValue,
          maximumValue: micronSpecifications.maximumValue,
          multipleValues: micronSpecifications.multipleValues,
          displayLabel: micronSpecifications.displayLabel,
          sourceType: micronSpecifications.sourceType,
          notes: micronSpecifications.notes,
        })
        .from(micronSpecifications)
        .where(eq(micronSpecifications.entryId, id))
        .limit(1),
      tx
        .select({
          context: entryMicronContexts.context,
          mode: entryMicronContexts.mode,
          singleValue: entryMicronContexts.singleValue,
          minimumValue: entryMicronContexts.minimumValue,
          maximumValue: entryMicronContexts.maximumValue,
          multipleValues: entryMicronContexts.multipleValues,
          displayLabel: entryMicronContexts.displayLabel,
          sourceType: entryMicronContexts.sourceType,
          notes: entryMicronContexts.notes,
        })
        .from(entryMicronContexts)
        .where(eq(entryMicronContexts.entryId, id)),
      tx.select({ tagId: entryTags.tagId }).from(entryTags).where(eq(entryTags.entryId, id)),
    ]);
    let currentMicron: CreateEntry["micron"] = storedMicron
      ? {
          ...storedMicron,
          multipleValues: storedMicron.multipleValues ?? [],
          sourceType:
            storedMicron.sourceType === "LABEL" ? ("DECLARED" as const) : storedMicron.sourceType,
        }
      : null;
    const currentContexts: CreateEntry["micronContexts"] = storedContexts.map((value) => ({
      ...value,
      multipleValues: value.multipleValues ?? [],
      sourceType: value.sourceType === "LABEL" ? ("DECLARED" as const) : value.sourceType,
    }));
    const collectionContext = currentContexts.find(
      (value) => value.context === "COLLECTION_SEPARATION" && value.mode !== "NONE",
    );
    if (
      collectionContext &&
      currentMicron &&
      !micronValuesEqual(collectionContext, currentMicron)
    ) {
      throw new AppError(
        "INCONSISTENT_MICRON_VALUES",
        "La fraction de collecte enregistrée est incohérente.",
        400,
      );
    }
    if (collectionContext && !currentMicron) {
      currentMicron = legacyMicronFromContext(collectionContext);
      await tx.insert(micronSpecifications).values(micronInsertValues(id, currentMicron));
    } else if (currentMicron && !collectionContext && currentMicron.mode !== "NONE") {
      const synthesized = collectionContextFromLegacy(currentMicron);
      currentContexts.push(synthesized);
      await tx.insert(entryMicronContexts).values(micronContextInsertValues(id, synthesized));
    }
    await validateReferences(tx, {
      categoryId: entry.categoryId,
      subcategoryId: entry.subcategoryId,
      fields: Object.fromEntries(
        storedFields.map((field) => [
          field.fieldDefinitionId,
          field.value as CreateEntry["fields"][string],
        ]),
      ),
      tagIds: storedTags.map((tag) => tag.tagId),
      micron: currentMicron,
      micronContexts: currentContexts,
    });
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
        .select({
          fieldDefinitionId: entryFieldValues.fieldDefinitionId,
          value: entryFieldValues.value,
        })
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
      if (
        values.length !== requiredFields.length ||
        values.some((value) => isEmptyDynamicFieldValue(value.value))
      ) {
        throw new AppError(
          "MISSING_REQUIRED_FIELDS",
          "Des champs obligatoires sont manquants.",
          400,
          {
            details: {
              fieldIds: requiredFields
                .filter(
                  (field) =>
                    !values.some(
                      (value) =>
                        value.fieldDefinitionId === field.id &&
                        !isEmptyDynamicFieldValue(value.value),
                    ),
                )
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
        source: "API",
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

function entryModerationAuditAction(previousStatus: string, nextStatus: string): string {
  if (previousStatus === "HIDDEN" && nextStatus === "PUBLISHED") return "ENTRY_UNHIDDEN";
  if (previousStatus === "ARCHIVED" && nextStatus === "PUBLISHED") return "ENTRY_RESTORED";
  return `ENTRY_${nextStatus}`;
}

export async function moderateEntry(
  id: string,
  input: ModerateEntry,
  actor: CurrentUser,
  requestId?: string,
  source: AuditSource = "WEB_ADMIN",
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
      if (
        actor.role === "MODERATOR" &&
        (entry.status !== "PENDING_REVIEW" ||
          !["CHANGES_REQUESTED", "APPROVED", "REJECTED"].includes(input.status))
      ) {
        throw forbidden("Un modérateur peut uniquement traiter une nouvelle fiche en attente.");
      }
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
          action: entryModerationAuditAction(entry.status, input.status),
          entityType: "ENTRY",
          entityId: id,
          source,
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

  if (["CHANGES_REQUESTED", "APPROVED", "REJECTED"].includes(result.status)) {
    const [recipient] = await getDb()
      .select({
        userId: users.id,
        telegramId: users.telegramId,
        entryName: entries.name,
      })
      .from(entries)
      .innerJoin(users, eq(users.id, entries.originalContributorId))
      .where(eq(entries.id, id))
      .limit(1);
    if (recipient) {
      const changesRequested = result.status === "CHANGES_REQUESTED";
      const actionUrl = changesRequested ? `/profil/fiches/${id}/modifier` : "/profil/fiches";
      const title = changesRequested
        ? `Modification demandée pour « ${recipient.entryName} »`
        : result.status === "APPROVED"
          ? `Fiche « ${recipient.entryName} » approuvée`
          : `Fiche « ${recipient.entryName} » refusée`;
      const message = input.reason?.trim() || title;
      await Promise.allSettled([
        createUserNotification({
          userId: recipient.userId,
          type:
            result.status === "APPROVED"
              ? "ENTRY_APPROVED"
              : result.status === "REJECTED"
                ? "ENTRY_REJECTED"
                : "ENTRY_CHANGES_REQUESTED",
          title,
          message,
          relatedEntryId: id,
          actionUrl,
          metadata: { status: result.status },
        }),
        sendEntryStatusTelegram({
          telegramId: recipient.telegramId,
          text: `${title}\n\n${message}`,
          entryId: id,
          actionUrl,
          buttonLabel: changesRequested ? "Modifier ma fiche" : "Voir mes fiches",
        }),
      ]);
    }
  }
  return result;
}

export async function softDeleteEntry(
  id: string,
  actor: CurrentUser,
  requestId?: string,
  source: AuditSource = "API",
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
        action: "ENTRY_SOFT_DELETED",
        entityType: "ENTRY",
        entityId: id,
        source,
        requestId,
        before: { status: entry.status },
        after: { status: "DELETED" },
      }),
    );
  });
}

export async function getLatestEntryChangeRequest(entryId: string, actor: CurrentUser) {
  const [entry] = await getDb()
    .select({ id: entries.id, createdById: entries.createdById, status: entries.status })
    .from(entries)
    .where(and(eq(entries.id, entryId), isNull(entries.deletedAt)))
    .limit(1);
  if (!entry) throw notFound("Capture");
  if (entry.createdById !== actor.id && !hasPermission(actor.role, "entry:update:any")) {
    throw forbidden();
  }
  const [submission] = await getDb()
    .select({ reason: submissions.reviewReason, reviewedAt: submissions.reviewedAt })
    .from(submissions)
    .where(and(eq(submissions.entryId, entryId), eq(submissions.status, "CHANGES_REQUESTED")))
    .orderBy(desc(submissions.reviewedAt), desc(submissions.updatedAt))
    .limit(1);
  return {
    status: entry.status,
    reason: submission?.reason ?? null,
    reviewedAt: submission?.reviewedAt ?? null,
  };
}

export async function permanentlyDeleteEntry(
  id: string,
  confirmation: string,
  actor: CurrentUser,
  requestId?: string,
) {
  if (actor.role !== "OWNER" || !hasPermission(actor.role, "entry:delete:permanent")) {
    throw forbidden("Seul le propriétaire peut supprimer définitivement une fiche.");
  }
  const storageObjects = await getDb().transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1)
      .for("update");
    if (!entry) throw notFound("Capture");
    if (confirmation.trim() !== entry.name) {
      throw new AppError(
        "PERMANENT_DELETE_CONFIRMATION_MISMATCH",
        "La confirmation ne correspond pas au nom de la fiche.",
        400,
      );
    }
    const images = await tx
      .select({ bucket: entryImages.storageBucket, path: entryImages.objectPath })
      .from(entryImages)
      .where(eq(entryImages.entryId, id));
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "ENTRY_PERMANENTLY_DELETED",
        entityType: "ENTRY",
        entityId: id,
        source: "WEB_ADMIN",
        requestId,
        before: {
          name: entry.name,
          status: entry.status,
          originalContributorId: entry.originalContributorId,
        },
        after: { permanentlyDeleted: true },
      }),
    );
    await tx.delete(entries).where(eq(entries.id, id));
    return images;
  });
  try {
    await removeEntryStorageObjects(storageObjects);
  } catch {
    // The database deletion is authoritative; orphan cleanup can be retried from storage logs.
  }
  return { deleted: true, permanent: true };
}
