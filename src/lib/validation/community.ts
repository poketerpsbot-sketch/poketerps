import { z } from "zod";

import { paginationSchema, safeExternalUrlSchema, uuidSchema } from "@/lib/validation/common";

export const createReviewSchema = z.object({
  content: z.string().trim().min(10).max(5_000),
  overallRating: z.number().min(0).max(10),
  ratings: z
    .array(z.object({ criterionId: uuidSchema, score: z.number().min(0).max(10) }))
    .max(30)
    .refine(
      (items) => new Set(items.map((item) => item.criterionId)).size === items.length,
      "Chaque critère ne peut être noté qu’une seule fois.",
    )
    .default([]),
});

export const resubmitReviewSchema = createReviewSchema.extend({
  content: z.string().trim().min(10).max(5_000),
});

export const moderateReviewSchema = z
  .object({
    status: z.enum(["CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "REJECTED", "HIDDEN"]),
    reason: z.string().trim().max(2_000).optional(),
  })
  .superRefine((value, context) => {
    if (["CHANGES_REQUESTED", "REJECTED", "HIDDEN"].includes(value.status) && !value.reason) {
      context.addIssue({ code: "custom", path: ["reason"], message: "Un motif est requis." });
    }
  });

export const createMessageSchema = z.object({
  type: z.enum(["IMPROVEMENT", "BUG", "REPORT", "OTHER"]),
  subject: z.string().trim().min(3).max(180),
  content: z.string().trim().min(10).max(10_000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  relatedEntryId: uuidSchema.nullable().optional(),
  relatedReviewId: uuidSchema.nullable().optional(),
  relatedPartnerId: uuidSchema.nullable().optional(),
  pageUrl: safeExternalUrlSchema.nullable().optional(),
  allowContact: z.boolean().default(false),
  metadata: z
    .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
    .default({}),
  attachmentPaths: z.array(z.string().min(1).max(500)).max(5).default([]),
});

export const messageQuerySchema = paginationSchema.extend({
  status: z.enum(["NEW", "READ", "IN_PROGRESS", "RESOLVED", "ARCHIVED", "REJECTED"]).optional(),
  type: z.enum(["IMPROVEMENT", "BUG", "REPORT", "OTHER"]).optional(),
  query: z.string().trim().max(120).optional(),
});

export const updateMessageSchema = z
  .object({
    status: z.enum(["READ", "IN_PROGRESS", "RESOLVED", "ARCHIVED", "REJECTED"]).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    assignedAdminId: uuidSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

export const favoriteSchema = z.object({ entryId: uuidSchema });

export const notificationQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

export const markNotificationsReadSchema = z
  .object({
    notificationId: uuidSchema.optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.notificationId) !== Boolean(value.all), {
    message: "Indique une notification ou demande de tout marquer comme lu.",
  });
