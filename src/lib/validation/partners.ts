import { z } from "zod";

import { paginationSchema, safeExternalUrlSchema, uuidSchema } from "@/lib/validation/common";

const nullableUrl = safeExternalUrlSchema.nullable().optional();

export const partnerInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  categoryId: uuidSchema.nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  logoPath: z.string().trim().max(500).nullable().optional(),
  coverPath: z.string().trim().max(500).nullable().optional(),
  websiteUrl: nullableUrl,
  telegramUrl: nullableUrl,
  instagramUrl: nullableUrl,
  otherUrl: nullableUrl,
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(-10_000).max(10_000).default(0),
  featuredFrom: z.iso.datetime().nullable().optional(),
  featuredUntil: z.iso.datetime().nullable().optional(),
});

export const updatePartnerSchema = partnerInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucune modification fournie.",
  });

export const partnerQuerySchema = paginationSchema.extend({
  featured: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  includeInactive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
});

export const partnerClickSchema = z.object({
  target: z.enum(["website", "telegram", "instagram", "other"]),
});
