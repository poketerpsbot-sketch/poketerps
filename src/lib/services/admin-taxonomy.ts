import "server-only";

import { and, asc, count, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import {
  auditLogs,
  categories,
  dynamicFieldDefinitions,
  dynamicFieldOptions,
  micronPresets,
  subcategoryMicronPresets,
  subcategories,
} from "@/lib/db/schema";
import { AppError, conflict, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import { slugify } from "@/lib/validation/common";
import type {
  adminDynamicFieldQuerySchema,
  adminSubcategoryQuerySchema,
  adminTaxonomyQuerySchema,
  categoryInputSchema,
  dynamicFieldInputSchema,
  dynamicFieldOptionInputSchema,
  dynamicFieldOptionQuerySchema,
  micronPresetInputSchema,
  subcategoryInputSchema,
  updateCategorySchema,
  updateDynamicFieldOptionSchema,
  updateDynamicFieldSchema,
  updateMicronPresetSchema,
  updateSubcategorySchema,
} from "@/lib/validation/admin-management";

type CategoryInput = z.infer<typeof categoryInputSchema>;
type CategoryUpdate = z.infer<typeof updateCategorySchema>;
type SubcategoryInput = z.infer<typeof subcategoryInputSchema>;
type SubcategoryUpdate = z.infer<typeof updateSubcategorySchema>;
type DynamicFieldInput = z.infer<typeof dynamicFieldInputSchema>;
type DynamicFieldUpdate = z.infer<typeof updateDynamicFieldSchema>;
type DynamicFieldOptionInput = z.infer<typeof dynamicFieldOptionInputSchema>;
type DynamicFieldOptionUpdate = z.infer<typeof updateDynamicFieldOptionSchema>;
type MicronPresetInput = z.infer<typeof micronPresetInputSchema>;
type MicronPresetUpdate = z.infer<typeof updateMicronPresetSchema>;
type TaxonomyQuery = z.infer<typeof adminTaxonomyQuerySchema>;
type SubcategoryQuery = z.infer<typeof adminSubcategoryQuerySchema>;
type DynamicFieldQuery = z.infer<typeof adminDynamicFieldQuerySchema>;
type DynamicFieldOptionQuery = z.infer<typeof dynamicFieldOptionQuerySchema>;

const categorySelection = {
  id: categories.id,
  slug: categories.slug,
  name: categories.name,
  technicalName: categories.technicalName,
  displayName: categories.displayName,
  frenchExplanation: categories.frenchExplanation,
  icon: categories.icon,
  description: categories.description,
  disclaimer: categories.disclaimer,
  sortOrder: categories.sortOrder,
  isVisible: categories.isVisible,
  createdAt: categories.createdAt,
  updatedAt: categories.updatedAt,
  deletedAt: categories.deletedAt,
};

const subcategorySelection = {
  id: subcategories.id,
  categoryId: subcategories.categoryId,
  slug: subcategories.slug,
  name: subcategories.name,
  technicalName: subcategories.technicalName,
  displayName: subcategories.displayName,
  frenchExplanation: subcategories.frenchExplanation,
  description: subcategories.description,
  micronRequirement: subcategories.micronRequirement,
  allowedMicronContexts: subcategories.allowedMicronContexts,
  sortOrder: subcategories.sortOrder,
  isVisible: subcategories.isVisible,
  createdAt: subcategories.createdAt,
  updatedAt: subcategories.updatedAt,
  deletedAt: subcategories.deletedAt,
};

const dynamicFieldSelection = {
  id: dynamicFieldDefinitions.id,
  categoryId: dynamicFieldDefinitions.categoryId,
  subcategoryId: dynamicFieldDefinitions.subcategoryId,
  key: dynamicFieldDefinitions.key,
  label: dynamicFieldDefinitions.label,
  description: dynamicFieldDefinitions.description,
  fieldType: dynamicFieldDefinitions.fieldType,
  unit: dynamicFieldDefinitions.unit,
  placeholder: dynamicFieldDefinitions.placeholder,
  validationRules: dynamicFieldDefinitions.validationRules,
  isRequired: dynamicFieldDefinitions.isRequired,
  isFilterable: dynamicFieldDefinitions.isFilterable,
  isSearchable: dynamicFieldDefinitions.isSearchable,
  isVisible: dynamicFieldDefinitions.isVisible,
  sortOrder: dynamicFieldDefinitions.sortOrder,
  createdAt: dynamicFieldDefinitions.createdAt,
  updatedAt: dynamicFieldDefinitions.updatedAt,
  deletedAt: dynamicFieldDefinitions.deletedAt,
};

const optionSelection = {
  id: dynamicFieldOptions.id,
  fieldDefinitionId: dynamicFieldOptions.fieldDefinitionId,
  value: dynamicFieldOptions.value,
  label: dynamicFieldOptions.label,
  description: dynamicFieldOptions.description,
  sortOrder: dynamicFieldOptions.sortOrder,
  isActive: dynamicFieldOptions.isActive,
  createdAt: dynamicFieldOptions.createdAt,
  updatedAt: dynamicFieldOptions.updatedAt,
};

const micronPresetSelection = {
  id: micronPresets.id,
  slug: micronPresets.slug,
  context: micronPresets.context,
  mode: micronPresets.mode,
  label: micronPresets.label,
  technicalName: micronPresets.technicalName,
  displayName: micronPresets.displayName,
  frenchExplanation: micronPresets.frenchExplanation,
  singleValue: micronPresets.singleValue,
  minimumValue: micronPresets.minimumValue,
  maximumValue: micronPresets.maximumValue,
  multipleValues: micronPresets.multipleValues,
  isFullSpectrum: micronPresets.isFullSpectrum,
  isMixedMicron: micronPresets.isMixedMicron,
  sortOrder: micronPresets.sortOrder,
  isActive: micronPresets.isActive,
  createdAt: micronPresets.createdAt,
};

function normalizedMicronPresetValues(value: {
  mode: "NONE" | "SINGLE" | "RANGE" | "MULTIPLE" | "FULL_SPECTRUM" | "MIXED";
  singleValue?: number | null;
  minimumValue?: number | null;
  maximumValue?: number | null;
  multipleValues?: number[] | null;
}) {
  if (value.mode === "SINGLE" && value.singleValue == null) {
    throw new AppError("INVALID_MICRON_PRESET", "Une valeur unique est requise.", 400);
  }
  if (
    value.mode === "RANGE" &&
    (value.minimumValue == null ||
      value.maximumValue == null ||
      value.minimumValue > value.maximumValue)
  ) {
    throw new AppError("INVALID_MICRON_PRESET", "La plage micron est invalide.", 400);
  }
  if (value.mode === "MULTIPLE" && !value.multipleValues?.length) {
    throw new AppError("INVALID_MICRON_PRESET", "Les valeurs micron sont requises.", 400);
  }
  return {
    singleValue: value.mode === "SINGLE" ? value.singleValue : null,
    minimumValue: value.mode === "RANGE" ? value.minimumValue : null,
    maximumValue: value.mode === "RANGE" ? value.maximumValue : null,
    multipleValues:
      value.mode === "MULTIPLE"
        ? [...new Set(value.multipleValues)].sort((left, right) => left - right)
        : null,
    isFullSpectrum: value.mode === "FULL_SPECTRUM",
    isMixedMicron: value.mode === "MIXED",
  };
}

type TaxonomyExecutor = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function replaceSubcategoryMicronPresets(
  executor: TaxonomyExecutor,
  subcategoryId: string,
  presetIds: string[],
  allowedContexts: Array<"COLLECTION_SEPARATION" | "PRESSING_BAG">,
  requirement: "ABSENT" | "OPTIONAL" | "REQUIRED",
) {
  const uniquePresetIds = [...new Set(presetIds)];
  const uniqueAllowedContexts = [...new Set(allowedContexts)];
  const selectedPresets = uniquePresetIds.length
    ? await executor
        .select({
          id: micronPresets.id,
          context: micronPresets.context,
          mode: micronPresets.mode,
        })
        .from(micronPresets)
        .where(and(inArray(micronPresets.id, uniquePresetIds), eq(micronPresets.isActive, true)))
        .for("share")
    : [];
  const selectedById = new Map(selectedPresets.map((preset) => [preset.id, preset]));
  const orderedPresets = uniquePresetIds.flatMap((id) => {
    const preset = selectedById.get(id);
    return preset ? [preset] : [];
  });
  if (
    selectedPresets.length !== uniquePresetIds.length ||
    selectedPresets.some(
      (preset) => !preset.context || !uniqueAllowedContexts.includes(preset.context),
    )
  ) {
    throw new AppError(
      "INVALID_MICRON_PRESET_SCOPE",
      "Une valeur micron est inactive ou incompatible avec les contextes autorisés.",
      400,
    );
  }
  if (
    requirement === "ABSENT" &&
    (uniqueAllowedContexts.length > 0 || uniquePresetIds.length > 0)
  ) {
    throw new AppError(
      "INVALID_ABSENT_MICRON_CONFIGURATION",
      "Une sous-catégorie sans micron ne peut conserver ni contexte ni valeur.",
      400,
    );
  }
  if (
    requirement === "REQUIRED" &&
    (uniqueAllowedContexts.length === 0 ||
      uniqueAllowedContexts.some(
        (context) =>
          !orderedPresets.some((preset) => preset.context === context && preset.mode !== "NONE"),
      ))
  ) {
    throw new AppError(
      "MISSING_REQUIRED_MICRON_PRESET",
      "Chaque contexte micron obligatoire doit proposer au moins une valeur réelle.",
      400,
    );
  }
  await executor
    .delete(subcategoryMicronPresets)
    .where(eq(subcategoryMicronPresets.subcategoryId, subcategoryId));
  if (orderedPresets.length) {
    await executor.insert(subcategoryMicronPresets).values(
      orderedPresets.map((preset, index) => ({
        subcategoryId,
        micronPresetId: preset.id,
        sortOrder: index * 10,
      })),
    );
  }
}

function searchPattern(query?: string): string | undefined {
  return query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
}

function visibilityCondition(
  column:
    | typeof categories.isVisible
    | typeof subcategories.isVisible
    | typeof dynamicFieldDefinitions.isVisible,
  visibility: "all" | "visible" | "hidden",
): SQL | undefined {
  if (visibility === "visible") return eq(column, true);
  if (visibility === "hidden") return eq(column, false);
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function taxonomyTransaction<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("Ce slug, cette clé ou cette valeur existe déjà.", "TAXONOMY_CONFLICT");
    }
    throw error;
  }
}

async function assertCategoryExists(
  executor: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  categoryId: string,
) {
  const [category] = await executor
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (!category) throw notFound("Catégorie");
}

async function assertSubcategoryScope(
  executor: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  categoryId: string,
  subcategoryId?: string | null,
) {
  await assertCategoryExists(executor, categoryId);
  if (!subcategoryId) return;
  const [subcategory] = await executor
    .select({ id: subcategories.id })
    .from(subcategories)
    .where(and(eq(subcategories.id, subcategoryId), eq(subcategories.categoryId, categoryId)))
    .limit(1);
  if (!subcategory) {
    throw new AppError(
      "INVALID_SUBCATEGORY_SCOPE",
      "La sous-catégorie n’appartient pas à la catégorie sélectionnée.",
      400,
    );
  }
}

export async function listAdminCategories(query: TaxonomyQuery) {
  const conditions: SQL[] = [];
  const pattern = searchPattern(query.query);
  const visibility = visibilityCondition(categories.isVisible, query.visibility);
  if (pattern) {
    conditions.push(or(ilike(categories.name, pattern), ilike(categories.slug, pattern)) as SQL);
  }
  if (visibility) conditions.push(visibility);
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select(categorySelection)
      .from(categories)
      .where(where)
      .orderBy(asc(categories.sortOrder), asc(categories.name))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(categories).where(where),
  ]);
  return { categories: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function createCategory(input: CategoryInput, actor: CurrentUser, requestId?: string) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(categories)
        .values({ ...input, slug: input.slug ?? slugify(input.name) })
        .returning(categorySelection);
      if (!created) throw new Error("Category insert failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "CATEGORY_CREATED",
          entityType: "CATEGORY",
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

export async function updateCategory(
  id: string,
  input: CategoryUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select(categorySelection)
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1)
        .for("update");
      if (!existing) throw notFound("Catégorie");
      const [updated] = await tx
        .update(categories)
        .set({
          ...input,
          ...(input.isVisible === true ? { deletedAt: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning(categorySelection);
      if (!updated) throw new Error("Category update failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action:
            input.isVisible === false
              ? "CATEGORY_HIDDEN"
              : input.isVisible === true
                ? "CATEGORY_RESTORED"
                : "CATEGORY_UPDATED",
          entityType: "CATEGORY",
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

export async function listAdminSubcategories(query: SubcategoryQuery) {
  const conditions: SQL[] = [];
  const pattern = searchPattern(query.query);
  const visibility = visibilityCondition(subcategories.isVisible, query.visibility);
  if (query.categoryId) conditions.push(eq(subcategories.categoryId, query.categoryId));
  if (pattern) {
    conditions.push(
      or(ilike(subcategories.name, pattern), ilike(subcategories.slug, pattern)) as SQL,
    );
  }
  if (visibility) conditions.push(visibility);
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select({
        ...subcategorySelection,
        category: { id: categories.id, slug: categories.slug, name: categories.name },
      })
      .from(subcategories)
      .innerJoin(categories, eq(subcategories.categoryId, categories.id))
      .where(where)
      .orderBy(asc(categories.sortOrder), asc(subcategories.sortOrder), asc(subcategories.name))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(subcategories).where(where),
  ]);
  const rowIds = rows.map((row) => row.id);
  const mappings = rowIds.length
    ? await db
        .select({
          subcategoryId: subcategoryMicronPresets.subcategoryId,
          micronPresetId: subcategoryMicronPresets.micronPresetId,
        })
        .from(subcategoryMicronPresets)
        .where(inArray(subcategoryMicronPresets.subcategoryId, rowIds))
        .orderBy(asc(subcategoryMicronPresets.sortOrder))
    : [];
  const mappedIds = new Map<string, string[]>();
  for (const mapping of mappings) {
    const values = mappedIds.get(mapping.subcategoryId) ?? [];
    values.push(mapping.micronPresetId);
    mappedIds.set(mapping.subcategoryId, values);
  }
  return {
    subcategories: rows.map((row) => ({
      ...row,
      micronPresetIds: mappedIds.get(row.id) ?? [],
    })),
    total: Number(totals[0]?.total ?? 0),
  };
}

export async function createSubcategory(
  input: SubcategoryInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      await assertCategoryExists(tx, input.categoryId);
      const { micronPresetIds, ...subcategoryInput } = input;
      const [created] = await tx
        .insert(subcategories)
        .values({ ...subcategoryInput, slug: input.slug ?? slugify(input.name) })
        .returning(subcategorySelection);
      if (!created) throw new Error("Subcategory insert failed");
      await replaceSubcategoryMicronPresets(
        tx,
        created.id,
        micronPresetIds,
        input.allowedMicronContexts,
        input.micronRequirement,
      );
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "SUBCATEGORY_CREATED",
          entityType: "SUBCATEGORY",
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

export async function updateSubcategory(
  id: string,
  input: SubcategoryUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select(subcategorySelection)
        .from(subcategories)
        .where(eq(subcategories.id, id))
        .limit(1)
        .for("update");
      if (!existing) throw notFound("Sous-catégorie");
      if (input.categoryId) await assertCategoryExists(tx, input.categoryId);
      const { micronPresetIds, ...subcategoryUpdate } = input;
      const [updated] = await tx
        .update(subcategories)
        .set({
          ...subcategoryUpdate,
          ...(input.isVisible === true ? { deletedAt: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(subcategories.id, id))
        .returning(subcategorySelection);
      if (!updated) throw new Error("Subcategory update failed");
      const shouldRefreshMicronMappings =
        micronPresetIds !== undefined ||
        input.allowedMicronContexts !== undefined ||
        input.micronRequirement !== undefined;
      let effectivePresetIds = micronPresetIds;
      if (shouldRefreshMicronMappings && effectivePresetIds === undefined) {
        const currentMappings = await tx
          .select({ micronPresetId: subcategoryMicronPresets.micronPresetId })
          .from(subcategoryMicronPresets)
          .where(eq(subcategoryMicronPresets.subcategoryId, id))
          .orderBy(asc(subcategoryMicronPresets.sortOrder));
        effectivePresetIds = currentMappings.map((mapping) => mapping.micronPresetId);
      }
      if (shouldRefreshMicronMappings) {
        await replaceSubcategoryMicronPresets(
          tx,
          id,
          effectivePresetIds ?? [],
          updated.allowedMicronContexts,
          updated.micronRequirement,
        );
      }
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action:
            input.isVisible === false
              ? "SUBCATEGORY_HIDDEN"
              : input.isVisible === true
                ? "SUBCATEGORY_RESTORED"
                : "SUBCATEGORY_UPDATED",
          entityType: "SUBCATEGORY",
          entityId: id,
          source: "WEB_ADMIN",
          requestId,
          before: existing,
          after: {
            ...updated,
            ...(effectivePresetIds !== undefined ? { micronPresetIds: effectivePresetIds } : {}),
          },
        }),
      );
      return updated;
    }),
  );
}

export async function listAdminMicronPresets(includeInactive = true) {
  const db = getDb();
  return db
    .select(micronPresetSelection)
    .from(micronPresets)
    .where(includeInactive ? undefined : eq(micronPresets.isActive, true))
    .orderBy(asc(micronPresets.context), asc(micronPresets.sortOrder), asc(micronPresets.label));
}

export async function createMicronPreset(
  input: MicronPresetInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(micronPresets)
        .values({
          ...input,
          ...normalizedMicronPresetValues(input),
        })
        .returning(micronPresetSelection);
      if (!created) throw new Error("Micron preset insert failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "MICRON_PRESET_CREATED",
          entityType: "MICRON_PRESET",
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

export async function updateMicronPreset(
  id: string,
  input: MicronPresetUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select(micronPresetSelection)
        .from(micronPresets)
        .where(eq(micronPresets.id, id))
        .limit(1)
        .for("update");
      if (!existing) throw notFound("Valeur micron");
      const mappedRows = await tx
        .select({ subcategoryId: subcategoryMicronPresets.subcategoryId })
        .from(subcategoryMicronPresets)
        .where(eq(subcategoryMicronPresets.micronPresetId, id))
        .limit(1);
      if (
        mappedRows.length > 0 &&
        ((input.context !== undefined && input.context !== existing.context) ||
          input.isActive === false)
      ) {
        throw conflict(
          "Retire d’abord cette valeur des sous-catégories avant de changer son contexte ou de la désactiver.",
          "MICRON_PRESET_IN_USE",
        );
      }
      const merged = { ...existing, ...input };
      const [updated] = await tx
        .update(micronPresets)
        .set({
          ...input,
          ...normalizedMicronPresetValues(merged),
        })
        .where(eq(micronPresets.id, id))
        .returning(micronPresetSelection);
      if (!updated) throw new Error("Micron preset update failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: input.isActive === false ? "MICRON_PRESET_HIDDEN" : "MICRON_PRESET_UPDATED",
          entityType: "MICRON_PRESET",
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

export async function listAdminDynamicFields(query: DynamicFieldQuery) {
  const conditions: SQL[] = [];
  const pattern = searchPattern(query.query);
  const visibility = visibilityCondition(dynamicFieldDefinitions.isVisible, query.visibility);
  if (query.categoryId) conditions.push(eq(dynamicFieldDefinitions.categoryId, query.categoryId));
  if (query.subcategoryId) {
    conditions.push(eq(dynamicFieldDefinitions.subcategoryId, query.subcategoryId));
  }
  if (pattern) {
    conditions.push(
      or(
        ilike(dynamicFieldDefinitions.key, pattern),
        ilike(dynamicFieldDefinitions.label, pattern),
      ) as SQL,
    );
  }
  if (visibility) conditions.push(visibility);
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select(dynamicFieldSelection)
      .from(dynamicFieldDefinitions)
      .where(where)
      .orderBy(
        asc(dynamicFieldDefinitions.categoryId),
        asc(dynamicFieldDefinitions.subcategoryId),
        asc(dynamicFieldDefinitions.sortOrder),
        asc(dynamicFieldDefinitions.label),
      )
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(dynamicFieldDefinitions).where(where),
  ]);
  const options = rows.length
    ? await db
        .select(optionSelection)
        .from(dynamicFieldOptions)
        .where(
          inArray(
            dynamicFieldOptions.fieldDefinitionId,
            rows.map((field) => field.id),
          ),
        )
        .orderBy(
          asc(dynamicFieldOptions.fieldDefinitionId),
          asc(dynamicFieldOptions.sortOrder),
          asc(dynamicFieldOptions.label),
        )
    : [];
  const optionsByField = new Map<string, typeof options>();
  for (const option of options) {
    const current = optionsByField.get(option.fieldDefinitionId) ?? [];
    current.push(option);
    optionsByField.set(option.fieldDefinitionId, current);
  }
  return {
    fields: rows.map((field) => ({ ...field, options: optionsByField.get(field.id) ?? [] })),
    total: Number(totals[0]?.total ?? 0),
  };
}

export async function createDynamicField(
  input: DynamicFieldInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      await assertSubcategoryScope(tx, input.categoryId, input.subcategoryId);
      const [created] = await tx
        .insert(dynamicFieldDefinitions)
        .values({ ...input, subcategoryId: input.subcategoryId ?? null })
        .returning(dynamicFieldSelection);
      if (!created) throw new Error("Dynamic field insert failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "DYNAMIC_FIELD_CREATED",
          entityType: "DYNAMIC_FIELD",
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

export async function updateDynamicField(
  id: string,
  input: DynamicFieldUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select(dynamicFieldSelection)
        .from(dynamicFieldDefinitions)
        .where(eq(dynamicFieldDefinitions.id, id))
        .limit(1)
        .for("update");
      if (!existing) throw notFound("Champ dynamique");
      const categoryId = input.categoryId ?? existing.categoryId;
      const subcategoryId =
        input.subcategoryId === undefined ? existing.subcategoryId : input.subcategoryId;
      await assertSubcategoryScope(tx, categoryId, subcategoryId);
      const [updated] = await tx
        .update(dynamicFieldDefinitions)
        .set({
          ...input,
          ...(input.isVisible === true ? { deletedAt: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(dynamicFieldDefinitions.id, id))
        .returning(dynamicFieldSelection);
      if (!updated) throw new Error("Dynamic field update failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action:
            input.isVisible === false
              ? "DYNAMIC_FIELD_HIDDEN"
              : input.isVisible === true
                ? "DYNAMIC_FIELD_RESTORED"
                : "DYNAMIC_FIELD_UPDATED",
          entityType: "DYNAMIC_FIELD",
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

export async function listDynamicFieldOptions(
  fieldDefinitionId: string,
  query: DynamicFieldOptionQuery,
) {
  const conditions: SQL[] = [eq(dynamicFieldOptions.fieldDefinitionId, fieldDefinitionId)];
  if (!query.includeInactive) conditions.push(eq(dynamicFieldOptions.isActive, true));
  const where = and(...conditions);
  const db = getDb();
  const [field, rows, totals] = await Promise.all([
    db
      .select({ id: dynamicFieldDefinitions.id })
      .from(dynamicFieldDefinitions)
      .where(eq(dynamicFieldDefinitions.id, fieldDefinitionId))
      .limit(1),
    db
      .select(optionSelection)
      .from(dynamicFieldOptions)
      .where(where)
      .orderBy(asc(dynamicFieldOptions.sortOrder), asc(dynamicFieldOptions.label))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(dynamicFieldOptions).where(where),
  ]);
  if (!field[0]) throw notFound("Champ dynamique");
  return { options: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function createDynamicFieldOption(
  fieldDefinitionId: string,
  input: DynamicFieldOptionInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [field] = await tx
        .select({ id: dynamicFieldDefinitions.id })
        .from(dynamicFieldDefinitions)
        .where(eq(dynamicFieldDefinitions.id, fieldDefinitionId))
        .limit(1);
      if (!field) throw notFound("Champ dynamique");
      const [created] = await tx
        .insert(dynamicFieldOptions)
        .values({ ...input, fieldDefinitionId })
        .returning(optionSelection);
      if (!created) throw new Error("Dynamic field option insert failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "DYNAMIC_FIELD_OPTION_CREATED",
          entityType: "DYNAMIC_FIELD_OPTION",
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

export async function updateDynamicFieldOption(
  id: string,
  input: DynamicFieldOptionUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select(optionSelection)
        .from(dynamicFieldOptions)
        .where(eq(dynamicFieldOptions.id, id))
        .limit(1)
        .for("update");
      if (!existing) throw notFound("Option de champ dynamique");
      const [updated] = await tx
        .update(dynamicFieldOptions)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(dynamicFieldOptions.id, id))
        .returning(optionSelection);
      if (!updated) throw new Error("Dynamic field option update failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action:
            input.isActive === false
              ? "DYNAMIC_FIELD_OPTION_HIDDEN"
              : input.isActive === true
                ? "DYNAMIC_FIELD_OPTION_RESTORED"
                : "DYNAMIC_FIELD_OPTION_UPDATED",
          entityType: "DYNAMIC_FIELD_OPTION",
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
