import { z } from "zod";

import { paginationSchema, uuidSchema } from "@/lib/validation/common";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide.");

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const sortOrderSchema = z.number().int().min(-10_000).max(10_000);

export const adminTaxonomyQuerySchema = paginationSchema.extend({
  query: z.string().trim().max(120).optional(),
  visibility: z.enum(["all", "visible", "hidden"]).default("all"),
});

export const adminSubcategoryQuerySchema = adminTaxonomyQuerySchema.extend({
  categoryId: uuidSchema.optional(),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  technicalName: nullableText(160),
  displayName: nullableText(160),
  frenchExplanation: nullableText(2_000),
  slug: slugSchema.optional(),
  icon: nullableText(80),
  description: nullableText(5_000),
  disclaimer: nullableText(10_000),
  sortOrder: sortOrderSchema.default(0),
  isVisible: z.boolean().default(true),
});

export const updateCategorySchema = categoryInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie.",
  });

export const subcategoryInputSchema = z.object({
  categoryId: uuidSchema,
  name: z.string().trim().min(1).max(120),
  technicalName: nullableText(160),
  displayName: nullableText(160),
  frenchExplanation: nullableText(2_000),
  slug: slugSchema.optional(),
  description: nullableText(5_000),
  micronRequirement: z.enum(["ABSENT", "OPTIONAL", "REQUIRED"]).default("ABSENT"),
  allowedMicronContexts: z
    .array(z.enum(["COLLECTION_SEPARATION", "PRESSING_BAG"]))
    .max(2)
    .transform((values) => [...new Set(values)])
    .default([]),
  micronPresetIds: z.array(uuidSchema).max(100).default([]),
  sortOrder: sortOrderSchema.default(0),
  isVisible: z.boolean().default(true),
});

const micronPresetBaseSchema = z.object({
  slug: slugSchema,
  context: z.enum(["COLLECTION_SEPARATION", "PRESSING_BAG"]),
  mode: z.enum(["NONE", "SINGLE", "RANGE", "MULTIPLE", "FULL_SPECTRUM", "MIXED"]),
  label: z.string().trim().min(1).max(160),
  technicalName: nullableText(160),
  displayName: nullableText(160),
  frenchExplanation: nullableText(2_000),
  singleValue: z.number().int().min(1).max(1_000).nullable().optional(),
  minimumValue: z.number().int().min(1).max(1_000).nullable().optional(),
  maximumValue: z.number().int().min(1).max(1_000).nullable().optional(),
  multipleValues: z.array(z.number().int().min(1).max(1_000)).max(20).nullable().optional(),
  isFullSpectrum: z.boolean().default(false),
  isMixedMicron: z.boolean().default(false),
  sortOrder: sortOrderSchema.default(0),
  isActive: z.boolean().default(true),
});

function validateMicronPresetValues(
  value: Partial<z.infer<typeof micronPresetBaseSchema>>,
  context: z.RefinementCtx,
) {
  if (value.mode === "SINGLE" && value.singleValue == null) {
    context.addIssue({ code: "custom", path: ["singleValue"], message: "Valeur requise." });
  }
  if (
    value.mode === "RANGE" &&
    (value.minimumValue == null ||
      value.maximumValue == null ||
      value.minimumValue > value.maximumValue)
  ) {
    context.addIssue({ code: "custom", path: ["minimumValue"], message: "Plage invalide." });
  }
  if (value.mode === "MULTIPLE" && !value.multipleValues?.length) {
    context.addIssue({ code: "custom", path: ["multipleValues"], message: "Valeurs requises." });
  }
}

export const micronPresetInputSchema = micronPresetBaseSchema.superRefine(
  validateMicronPresetValues,
);

export const updateMicronPresetSchema = micronPresetBaseSchema
  .partial()
  .superRefine(validateMicronPresetValues)
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie.",
  });

export const updateSubcategorySchema = subcategoryInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie.",
  });

export const dynamicFieldTypeSchema = z.enum([
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "URL",
]);

export const adminDynamicFieldQuerySchema = adminTaxonomyQuerySchema.extend({
  categoryId: uuidSchema.optional(),
  subcategoryId: uuidSchema.optional(),
});

export const dynamicFieldInputSchema = z.object({
  categoryId: uuidSchema,
  subcategoryId: uuidSchema.nullable().optional(),
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, "La clé doit être en snake_case."),
  label: z.string().trim().min(1).max(160),
  description: nullableText(5_000),
  fieldType: dynamicFieldTypeSchema,
  unit: nullableText(40),
  placeholder: nullableText(240),
  validationRules: z.record(z.string(), z.json()).default({}),
  isRequired: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
  isSearchable: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});

export const updateDynamicFieldSchema = dynamicFieldInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie.",
  });

export const dynamicFieldOptionQuerySchema = paginationSchema.extend({
  includeInactive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
});

export const dynamicFieldOptionInputSchema = z.object({
  value: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160),
  description: nullableText(2_000),
  sortOrder: sortOrderSchema.default(0),
  isActive: z.boolean().default(true),
});

export const updateDynamicFieldOptionSchema = dynamicFieldOptionInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie.",
  });

export const userRoleSchema = z.enum(["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"]);

export const adminUsersQuerySchema = paginationSchema.extend({
  query: z.string().trim().max(120).optional(),
  role: userRoleSchema.optional(),
  banned: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const updateAdminUserSchema = z
  .object({
    role: userRoleSchema.optional(),
    isBanned: z.boolean().optional(),
    suspensionReason: z.string().trim().min(3).max(2_000).nullable().optional(),
    suspensionUntil: z.iso.datetime().nullable().optional(),
    restorationReason: z.string().trim().min(3).max(2_000).nullable().optional(),
    roleChangeReason: z.string().trim().min(3).max(2_000).nullable().optional(),
  })
  .refine((value) => value.role !== undefined || value.isBanned !== undefined, {
    message: "Un rôle ou un statut de bannissement est requis.",
  })
  .superRefine((value, context) => {
    if (value.role === "BANNED" && value.isBanned === false) {
      context.addIssue({
        code: "custom",
        path: ["isBanned"],
        message: "Le rôle BANNED est incompatible avec une réactivation.",
      });
    }
    if ((value.isBanned === true || value.role === "BANNED") && !value.suspensionReason) {
      context.addIssue({
        code: "custom",
        path: ["suspensionReason"],
        message: "Un motif est requis pour bannir un compte.",
      });
    }
    if (
      (value.isBanned === true || value.role === "BANNED") &&
      value.suspensionUntil &&
      Date.parse(value.suspensionUntil) <= Date.now()
    ) {
      context.addIssue({
        code: "custom",
        path: ["suspensionUntil"],
        message: "La fin de suspension doit être dans le futur.",
      });
    }
    if (value.isBanned === false && !value.restorationReason) {
      context.addIssue({
        code: "custom",
        path: ["restorationReason"],
        message: "Un motif est requis pour lever une suspension.",
      });
    }
    if (
      value.role !== undefined &&
      value.role !== "BANNED" &&
      value.isBanned !== false &&
      !value.roleChangeReason
    ) {
      context.addIssue({
        code: "custom",
        path: ["roleChangeReason"],
        message: "Un motif est requis pour changer un rôle.",
      });
    }
  });

export const adminUserInternalNoteSchema = z.object({
  content: z.string().trim().min(2).max(5_000),
});

export const adminUserTelegramMessageSchema = z.object({
  text: z.string().trim().min(1).max(4_096),
});

export const teamActivityQuerySchema = paginationSchema.extend({
  days: z.coerce.number().int().min(1).max(90).default(7),
  scope: z.enum(["all", "admins", "moderators"]).default("all"),
  userId: uuidSchema.optional(),
});

export const teamAuditQuerySchema = paginationSchema.extend({
  days: z.coerce.number().int().min(1).max(365).default(7),
  actorId: uuidSchema.optional(),
  action: z.string().trim().max(120).optional(),
});

export const teamPermissionCodeSchema = z.enum([
  "VIEW_ADMIN_ACTIVITY",
  "VIEW_MODERATOR_ACTIVITY",
  "VIEW_TEAM_AUDIT_LOG",
]);

export const updateUserTeamPermissionSchema = z.object({
  permissionCode: teamPermissionCodeSchema,
  isGranted: z.boolean().nullable(),
  expiresAt: z.iso.datetime().nullable().optional(),
});

export const settingValueTypeSchema = z.enum(["STRING", "NUMBER", "BOOLEAN", "JSON", "URL"]);

export const settingKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_.:-]+$/, "Clé de paramètre invalide.");

export const updateSettingSchema = z.object({
  value: z.json(),
  valueType: settingValueTypeSchema.optional(),
  description: nullableText(2_000),
  isPublic: z.boolean().optional(),
});

export const adminSettingsQuerySchema = paginationSchema.extend({
  query: z.string().trim().max(120).optional(),
  publicOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const badgeInputSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  description: nullableText(2_000),
  icon: nullableText(80),
  kind: z.enum(["ACTIVE", "HISTORICAL", "PERMANENT"]).default("PERMANENT"),
  criteria: z.record(z.string(), z.json()).default({}),
  isActive: z.boolean().default(true),
  sortOrder: sortOrderSchema.default(0),
});

export const updateBadgeSchema = badgeInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie.",
  });

export const adminBadgesQuerySchema = paginationSchema.extend({
  query: z.string().trim().max(120).optional(),
  includeInactive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
});

export const assignBadgeSchema = z
  .object({
    userId: uuidSchema,
    activeFrom: z.iso.datetime().nullable().optional(),
    activeUntil: z.iso.datetime().nullable().optional(),
    metadata: z.record(z.string(), z.json()).default({}),
  })
  .refine(
    (value) =>
      !value.activeFrom ||
      !value.activeUntil ||
      new Date(value.activeFrom) < new Date(value.activeUntil),
    { message: "La date de fin doit être postérieure à la date de début.", path: ["activeUntil"] },
  );

export const badgeAssignmentsQuerySchema = paginationSchema.extend({
  userId: uuidSchema.optional(),
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const updateBadgeAssignmentSchema = z
  .object({
    isActive: z.boolean(),
    reason: z.string().trim().min(3).max(2_000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (!value.isActive && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Un motif est requis pour révoquer un badge.",
      });
    }
  });
