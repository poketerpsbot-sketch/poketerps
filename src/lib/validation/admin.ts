import { z } from "zod";

import { entryStatusSchema } from "@/lib/validation/entries";
import { paginationSchema } from "@/lib/validation/common";

export const adminEntriesQuerySchema = paginationSchema.extend({
  status: entryStatusSchema.optional(),
  query: z.string().trim().max(120).optional(),
  category: z.string().trim().max(140).optional(),
  subcategory: z.string().trim().max(140).optional(),
});

export const adminReviewsQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      "DRAFT",
      "PENDING_REVIEW",
      "CHANGES_REQUESTED",
      "APPROVED",
      "PUBLISHED",
      "REJECTED",
      "HIDDEN",
      "DELETED",
    ])
    .optional(),
  query: z.string().trim().max(120).optional(),
});

export const auditQuerySchema = paginationSchema.extend({
  entityType: z.string().trim().min(1).max(80).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  entityId: z.string().trim().max(120).optional(),
  actorId: z.uuid().optional(),
  role: z.enum(["OWNER", "ADMIN", "MODERATOR"]).optional(),
  source: z
    .enum(["WEB", "TELEGRAM", "SYSTEM", "WEB_ADMIN", "TELEGRAM_ADMIN", "MINI_APP", "API"])
    .optional(),
  dateFrom: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  query: z.string().trim().max(120).optional(),
});

export const moderateCorrectionSubmissionSchema = z.object({
  status: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  reason: z.string().trim().max(2_000).optional(),
});

export const permanentDeleteEntrySchema = z.object({
  confirmation: z.string().trim().min(1).max(120),
});

export const publicationQuerySchema = paginationSchema.extend({
  status: z
    .enum(["DRAFT", "PREVIEWED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED", "CANCELLED"])
    .optional(),
});

export const createPublicationSchema = z
  .object({
    type: z.enum(["ENTRY", "PARTNER", "ANNOUNCEMENT"]),
    entryId: z.uuid().nullable().optional(),
    partnerId: z.uuid().nullable().optional(),
    text: z.string().trim().min(1).max(4_096).optional(),
    scheduledAt: z.iso.datetime().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "ENTRY" && !value.entryId) {
      context.addIssue({ code: "custom", path: ["entryId"], message: "Une fiche est requise." });
    }
    if (value.type === "PARTNER" && !value.partnerId) {
      context.addIssue({
        code: "custom",
        path: ["partnerId"],
        message: "Un partenaire est requis.",
      });
    }
    if (value.type === "ANNOUNCEMENT" && !value.text) {
      context.addIssue({ code: "custom", path: ["text"], message: "Un texte est requis." });
    }
  });

export const publicationActionSchema = z.object({
  action: z.enum(["preview", "publish", "cancel"]),
});
