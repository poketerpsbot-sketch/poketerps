import { z } from "zod";

import { paginationSchema, safeExternalUrlSchema } from "@/lib/validation/common";

export const contestStatusSchema = z.enum([
  "DRAFT",
  "UPCOMING",
  "OPEN",
  "FULL",
  "CLOSED",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "ENDED",
  "CANCELLED",
]);

export const contestTypeSchema = z.enum([
  "GAME",
  "DRAW",
  "CREATIVE",
  "ENTRY",
  "EXTERNAL_LINK",
  "COMMUNITY",
  "OTHER",
]);

export const contestScoringModeSchema = z.enum([
  "MANUAL",
  "ENTRY_LIKES",
  "ENTRY_VIEWS",
  "ENTRY_FAVORITES",
  "ENTRY_RATING",
  "COMPOSITE",
]);

export const contestParticipationStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "DISQUALIFIED",
]);

export const contestPhaseSchema = z.enum(["all", "upcoming", "active", "ended"]);

const jsonObjectSchema = z.record(z.string().max(120), z.unknown());
const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();

export const contestsQuerySchema = paginationSchema.extend({
  phase: contestPhaseSchema.default("all"),
  featured: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const contestLeaderboardQuerySchema = paginationSchema;

export const contestParticipationInputSchema = z.object({
  entryId: z.uuid().nullable().optional(),
  statement: nullableText(2_000),
});

const contestFieldsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(2).max(180),
  summary: z.string().trim().min(2).max(320),
  description: z.string().trim().min(2).max(20_000),
  rules: z.string().trim().min(2).max(20_000),
  imageUrl: safeExternalUrlSchema.nullable().optional(),
  status: contestStatusSchema,
  isFeatured: z.boolean(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  scoringMode: contestScoringModeSchema,
  criteria: jsonObjectSchema,
  reward: jsonObjectSchema,
  rewardBadgeId: z.uuid().nullable().optional(),
  maxParticipants: z.number().int().min(1).max(1_000_000).nullable().optional(),
  requireEntry: z.boolean(),
  contestType: contestTypeSchema.default("OTHER"),
  instructions: z.string().trim().max(20_000).default(""),
  participationSteps: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  externalUrl: safeExternalUrlSchema.nullable().optional(),
  telegramUrl: safeExternalUrlSchema.nullable().optional(),
  instagramUrl: safeExternalUrlSchema.nullable().optional(),
  terms: nullableText(20_000),
  additionalInformation: nullableText(20_000),
  registrationsOpen: z.boolean().default(true),
  registrationStartsAt: z.iso.datetime().nullable().optional(),
  registrationEndsAt: z.iso.datetime().nullable().optional(),
});

function validateContestDates(
  value: { startsAt?: string; endsAt?: string },
  context: z.RefinementCtx,
) {
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "La fin du concours doit suivre son début.",
    });
  }
  const registrationValue = value as {
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
  };
  if (
    registrationValue.registrationStartsAt &&
    registrationValue.registrationEndsAt &&
    new Date(registrationValue.registrationEndsAt) <=
      new Date(registrationValue.registrationStartsAt)
  ) {
    context.addIssue({
      code: "custom",
      path: ["registrationEndsAt"],
      message: "La fermeture des inscriptions doit suivre leur ouverture.",
    });
  }
}

export const createContestSchema = contestFieldsSchema.superRefine(validateContestDates);

export const updateContestSchema = contestFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Aucune modification fournie.")
  .superRefine(validateContestDates);

export const adminContestsQuerySchema = paginationSchema.extend({
  status: contestStatusSchema.optional(),
  query: z.string().trim().max(120).optional(),
});

export const adminContestParticipationsQuerySchema = paginationSchema.extend({
  status: contestParticipationStatusSchema.optional(),
  query: z.string().trim().max(120).optional(),
});

export const moderateContestParticipationSchema = z
  .object({
    status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED", "DISQUALIFIED"]).optional(),
    moderationNote: nullableText(2_000),
    manualScore: z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000).optional(),
    scoreBreakdown: jsonObjectSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Aucune modification fournie.");

export const selectContestWinnerSchema = z.object({
  participationId: z.uuid(),
  rank: z.number().int().min(1).max(1_000),
  label: nullableText(180),
  prize: jsonObjectSchema.default({}),
});
