import "server-only";

import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import {
  auditLogs,
  categories,
  dynamicFieldDefinitions,
  dynamicFieldOptions,
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
  subcategoryInputSchema,
  updateCategorySchema,
  updateDynamicFieldOptionSchema,
  updateDynamicFieldSchema,
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
type TaxonomyQuery = z.infer<typeof adminTaxonomyQuerySchema>;
type SubcategoryQuery = z.infer<typeof adminSubcategoryQuerySchema>;
type DynamicFieldQuery = z.infer<typeof adminDynamicFieldQuerySchema>;
type DynamicFieldOptionQuery = z.infer<typeof dynamicFieldOptionQuerySchema>;

const categorySelection = {
  id: categories.id,
  slug: categories.slug,
  name: categories.name,
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
  description: subcategories.description,
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
  return { subcategories: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function createSubcategory(
  input: SubcategoryInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return taxonomyTransaction(() =>
    getDb().transaction(async (tx) => {
      await assertCategoryExists(tx, input.categoryId);
      const [created] = await tx
        .insert(subcategories)
        .values({ ...input, slug: input.slug ?? slugify(input.name) })
        .returning(subcategorySelection);
      if (!created) throw new Error("Subcategory insert failed");
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: "SUBCATEGORY_CREATED",
          entityType: "SUBCATEGORY",
          entityId: created.id,
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
      const [updated] = await tx
        .update(subcategories)
        .set({
          ...input,
          ...(input.isVisible === true ? { deletedAt: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(subcategories.id, id))
        .returning(subcategorySelection);
      if (!updated) throw new Error("Subcategory update failed");
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
  return { fields: rows, total: Number(totals[0]?.total ?? 0) };
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
          requestId,
          before: existing,
          after: updated,
        }),
      );
      return updated;
    }),
  );
}
