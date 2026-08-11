import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  categories,
  dynamicFieldDefinitions,
  dynamicFieldOptions,
  entries,
  micronPresets,
  subcategoryMicronPresets,
  subcategories,
} from "@/lib/db/schema";

export async function listCategories() {
  const db = getDb();
  const [categoryRows, subcategoryRows, fieldRows, optionRows, entryCountRows, micronPresetRows] =
    await Promise.all([
      db
        .select({
          id: categories.id,
          slug: categories.slug,
          name: categories.name,
          technicalName: categories.technicalName,
          displayName: categories.displayName,
          frenchExplanation: categories.frenchExplanation,
          description: categories.description,
          icon: categories.icon,
          sortOrder: categories.sortOrder,
        })
        .from(categories)
        .where(and(eq(categories.isVisible, true), isNull(categories.deletedAt)))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          id: subcategories.id,
          categoryId: subcategories.categoryId,
          slug: subcategories.slug,
          name: subcategories.name,
          technicalName: subcategories.technicalName,
          displayName: subcategories.displayName,
          frenchExplanation: subcategories.frenchExplanation,
          micronRequirement: subcategories.micronRequirement,
          allowedMicronContexts: subcategories.allowedMicronContexts,
          description: subcategories.description,
          sortOrder: subcategories.sortOrder,
        })
        .from(subcategories)
        .where(and(eq(subcategories.isVisible, true), isNull(subcategories.deletedAt)))
        .orderBy(asc(subcategories.sortOrder), asc(subcategories.name)),
      db
        .select({
          id: dynamicFieldDefinitions.id,
          categoryId: dynamicFieldDefinitions.categoryId,
          subcategoryId: dynamicFieldDefinitions.subcategoryId,
          key: dynamicFieldDefinitions.key,
          label: dynamicFieldDefinitions.label,
          fieldType: dynamicFieldDefinitions.fieldType,
          helpText: dynamicFieldDefinitions.description,
          unit: dynamicFieldDefinitions.unit,
          isRequired: dynamicFieldDefinitions.isRequired,
          isFilterable: dynamicFieldDefinitions.isFilterable,
          sortOrder: dynamicFieldDefinitions.sortOrder,
          validation: dynamicFieldDefinitions.validationRules,
        })
        .from(dynamicFieldDefinitions)
        .where(
          and(
            eq(dynamicFieldDefinitions.isVisible, true),
            isNull(dynamicFieldDefinitions.deletedAt),
          ),
        )
        .orderBy(asc(dynamicFieldDefinitions.sortOrder)),
      db
        .select({
          id: dynamicFieldOptions.id,
          fieldDefinitionId: dynamicFieldOptions.fieldDefinitionId,
          value: dynamicFieldOptions.value,
          label: dynamicFieldOptions.label,
          sortOrder: dynamicFieldOptions.sortOrder,
        })
        .from(dynamicFieldOptions)
        .where(eq(dynamicFieldOptions.isActive, true))
        .orderBy(asc(dynamicFieldOptions.sortOrder)),
      db
        .select({
          categoryId: entries.categoryId,
          entryCount: sql<number>`count(*)::integer`,
        })
        .from(entries)
        .where(and(eq(entries.status, "PUBLISHED"), isNull(entries.deletedAt)))
        .groupBy(entries.categoryId),
      db
        .select({
          subcategoryId: subcategoryMicronPresets.subcategoryId,
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
          sortOrder: subcategoryMicronPresets.sortOrder,
        })
        .from(subcategoryMicronPresets)
        .innerJoin(micronPresets, eq(subcategoryMicronPresets.micronPresetId, micronPresets.id))
        .where(and(eq(micronPresets.isActive, true), sql`${micronPresets.context} is not null`))
        .orderBy(asc(subcategoryMicronPresets.sortOrder), asc(micronPresets.sortOrder)),
    ]);

  const entryCountByCategory = new Map(
    entryCountRows.map((row) => [row.categoryId, Number(row.entryCount)]),
  );

  const optionsByField = new Map<string, typeof optionRows>();
  for (const option of optionRows) {
    const values = optionsByField.get(option.fieldDefinitionId) ?? [];
    values.push(option);
    optionsByField.set(option.fieldDefinitionId, values);
  }
  const fieldsByCategory = new Map<
    string,
    Array<(typeof fieldRows)[number] & { options: typeof optionRows }>
  >();
  for (const field of fieldRows) {
    const values = fieldsByCategory.get(field.categoryId) ?? [];
    values.push({ ...field, options: optionsByField.get(field.id) ?? [] });
    fieldsByCategory.set(field.categoryId, values);
  }
  const subcategoriesByCategory = new Map<string, typeof subcategoryRows>();
  for (const subcategory of subcategoryRows) {
    const values = subcategoriesByCategory.get(subcategory.categoryId) ?? [];
    values.push(subcategory);
    subcategoriesByCategory.set(subcategory.categoryId, values);
  }
  const micronPresetsBySubcategory = new Map<string, typeof micronPresetRows>();
  for (const preset of micronPresetRows) {
    if (!preset.context) continue;
    const values = micronPresetsBySubcategory.get(preset.subcategoryId) ?? [];
    values.push(preset);
    micronPresetsBySubcategory.set(preset.subcategoryId, values);
  }

  return categoryRows.map((category) => ({
    ...category,
    entryCount: entryCountByCategory.get(category.id) ?? 0,
    subcategories: (subcategoriesByCategory.get(category.id) ?? []).map((subcategory) => ({
      ...subcategory,
      micronPresets: micronPresetsBySubcategory.get(subcategory.id) ?? [],
      fields: (fieldsByCategory.get(category.id) ?? []).filter(
        (field) => field.subcategoryId === null || field.subcategoryId === subcategory.id,
      ),
    })),
    fields: (fieldsByCategory.get(category.id) ?? []).filter(
      (field) => field.subcategoryId === null,
    ),
  }));
}
