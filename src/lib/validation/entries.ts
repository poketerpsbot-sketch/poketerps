import { z } from "zod";

import {
  longTextSchema,
  paginationSchema,
  shortTextSchema,
  uuidSchema,
} from "@/lib/validation/common";

export const entryStatusSchema = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN",
  "ARCHIVED",
  "DELETED",
]);

const dynamicValueSchema = z.union([
  z.string().max(2_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(200)).max(50),
  z.null(),
]);

export const micronSpecificationSchema = z
  .object({
    mode: z.enum(["NONE", "SINGLE", "RANGE", "MULTIPLE", "FULL_SPECTRUM", "MIXED"]),
    singleValue: z.number().int().min(1).max(1_000).nullable().optional(),
    minimumValue: z.number().int().min(1).max(1_000).nullable().optional(),
    maximumValue: z.number().int().min(1).max(1_000).nullable().optional(),
    multipleValues: z.array(z.number().int().min(1).max(1_000)).max(20).default([]),
    displayLabel: z.string().trim().max(120).nullable().optional(),
    sourceType: z
      .enum(["DECLARED", "PACKAGING", "LAB_REPORT", "COMMUNITY", "UNKNOWN"])
      .default("DECLARED"),
    notes: z.string().trim().max(1_000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "SINGLE" && !value.singleValue) {
      context.addIssue({
        code: "custom",
        path: ["singleValue"],
        message: "Valeur micron requise.",
      });
    }
    if (value.mode === "RANGE") {
      if (!value.minimumValue || !value.maximumValue) {
        context.addIssue({
          code: "custom",
          path: ["minimumValue"],
          message: "Plage micron requise.",
        });
      } else if (value.minimumValue > value.maximumValue) {
        context.addIssue({
          code: "custom",
          path: ["minimumValue"],
          message: "Plage micron inversée.",
        });
      }
    }
    if (value.mode === "MULTIPLE" && value.multipleValues.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["multipleValues"],
        message: "Valeurs micron requises.",
      });
    }
  });

export const micronContextSpecificationSchema = micronSpecificationSchema.extend({
  context: z.enum(["COLLECTION_SEPARATION", "PRESSING_BAG"]),
});

const entryBaseSchema = z.object({
  name: shortTextSchema,
  shortDescription: z.string().trim().max(500).nullable().optional(),
  fullDescription: z.string().trim().max(20_000).nullable().optional(),
  categoryId: uuidSchema,
  subcategoryId: uuidSchema.nullable().optional(),
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "UNKNOWN"]).default("UNKNOWN"),
  fields: z.record(uuidSchema, dynamicValueSchema).default({}),
  micron: micronSpecificationSchema.nullable().optional(),
  micronContexts: z
    .array(micronContextSpecificationSchema)
    .max(2)
    .default([])
    .refine(
      (values) => new Set(values.map((value) => value.context)).size === values.length,
      "Un seul relevé micron est autorisé par contexte.",
    ),
  tagIds: z.array(uuidSchema).max(30).default([]),
  primaryAromaId: uuidSchema.nullable().optional(),
  secondaryAromaIds: z.array(uuidSchema).max(20).optional(),
  customAromaLabel: z.string().trim().min(2).max(80).nullable().optional(),
});

function validateAromaSelection(
  value: { primaryAromaId?: string | null; secondaryAromaIds?: string[] },
  context: z.RefinementCtx,
) {
  if (value.primaryAromaId && value.secondaryAromaIds?.includes(value.primaryAromaId)) {
    context.addIssue({
      code: "custom",
      path: ["secondaryAromaIds"],
      message: "L’arôme principal ne peut pas aussi être secondaire.",
    });
  }
  if (
    value.secondaryAromaIds &&
    new Set(value.secondaryAromaIds).size !== value.secondaryAromaIds.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["secondaryAromaIds"],
      message: "Un arôme secondaire ne peut être sélectionné qu’une fois.",
    });
  }
}

export const createEntrySchema = entryBaseSchema.superRefine(validateAromaSelection);

export const updateEntrySchema = entryBaseSchema
  .partial()
  .superRefine(validateAromaSelection)
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit être fourni.",
  });

export const submitEntrySchema = z.object({
  note: z.string().trim().max(2_000).optional(),
});

export const moderateEntrySchema = z
  .object({
    status: z.enum([
      "CHANGES_REQUESTED",
      "APPROVED",
      "PUBLISHED",
      "REJECTED",
      "HIDDEN",
      "ARCHIVED",
    ]),
    reason: z.string().trim().max(2_000).optional(),
  })
  .superRefine((value, context) => {
    if (["CHANGES_REQUESTED", "REJECTED"].includes(value.status) && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Un message est obligatoire pour informer l’auteur.",
      });
    }
  });

export const catalogueQuerySchema = paginationSchema.extend({
  query: z.string().trim().max(120).optional(),
  category: z.string().trim().max(140).optional(),
  subcategory: z.string().trim().max(140).optional(),
  author: z.string().trim().max(140).optional(),
  tag: z.string().trim().max(100).optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  micronMin: z.coerce.number().int().min(1).max(1_000).optional(),
  micronMax: z.coerce.number().int().min(1).max(1_000).optional(),
  sort: z
    .enum(["recent", "oldest", "rating", "views", "likes", "reviews", "alphabetical", "number"])
    .default("recent"),
});

export const correctionSchema = z.object({
  entryId: uuidSchema,
  summary: longTextSchema,
  changes: z
    .array(
      z.object({
        fieldPath: z.string().trim().min(1).max(200),
        proposedValue: z.unknown(),
      }),
    )
    .min(1)
    .max(50),
});
