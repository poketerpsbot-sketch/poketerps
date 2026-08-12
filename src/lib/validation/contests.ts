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
  "ENDED_PENDING_RESULT",
]);

export const contestTypeSchema = z.enum([
  "GAME",
  "DRAW",
  "CREATIVE",
  "ENTRY",
  "EXTERNAL_LINK",
  "COMMUNITY",
  "OTHER",
  "WEIGHT_GUESS",
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
export const contestLinkTypeSchema = z.enum(["WEBSITE", "TELEGRAM", "INSTAGRAM", "OTHER"]);
export const contestLinkVisibilitySchema = z.enum(["PUBLIC", "PARTICIPANTS_ONLY"]);
export const contestTieBreakerModeSchema = z.enum(["FIRST_SUBMISSION", "RANDOM", "MANUAL"]);
export const contestResultPublicationModeSchema = z.enum(["MANUAL", "AUTOMATIC"]);
export const contestWeightUnitSchema = z.enum(["mg", "g", "kg", "CUSTOM"]);

const jsonObjectSchema = z.record(z.string().max(120), z.unknown());
const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const optionalUrl = safeExternalUrlSchema.nullable().optional();

export const contestsQuerySchema = paginationSchema.extend({
  phase: contestPhaseSchema.default("all"),
  featured: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
export const contestLeaderboardQuerySchema = paginationSchema;
export const contestHallOfFameQuerySchema = paginationSchema.extend({
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export const contestParticipationInputSchema = z.object({
  entryId: z.uuid().nullable().optional(),
  statement: nullableText(2_000),
});

export const contestGuessInputSchema = z.object({
  numericValue: z.number().finite().positive().max(1_000_000_000_000),
});

export const contestLinkInputSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(120),
  url: safeExternalUrlSchema,
  type: contestLinkTypeSchema.default("WEBSITE"),
  visibility: contestLinkVisibilitySchema.default("PUBLIC"),
  displayOrder: z.number().int().min(-10_000).max(10_000).default(0),
});

const contestFieldsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  title: z.string().trim().min(2).max(180),
  summary: nullableText(320),
  description: nullableText(20_000),
  rules: nullableText(20_000),
  imageUrl: optionalUrl,
  status: contestStatusSchema.default("DRAFT"),
  isFeatured: z.boolean().default(false),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  scoringMode: contestScoringModeSchema.default("MANUAL"),
  criteria: jsonObjectSchema.default({}),
  reward: jsonObjectSchema.default({}),
  rewardBadgeId: z.uuid().nullable().optional(),
  maxParticipants: z.number().int().min(1).max(1_000_000).nullable().optional(),
  requireEntry: z.boolean().default(false),
  contestType: contestTypeSchema.default("OTHER"),
  instructions: z.string().trim().max(20_000).default(""),
  participationSteps: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  externalUrl: optionalUrl,
  telegramUrl: optionalUrl,
  instagramUrl: optionalUrl,
  terms: nullableText(20_000),
  additionalInformation: nullableText(20_000),
  registrationsOpen: z.boolean().default(true),
  registrationStartsAt: z.iso.datetime().nullable().optional(),
  registrationEndsAt: z.iso.datetime().nullable().optional(),
  shortDescription: nullableText(320),
  publicIntro: nullableText(20_000),
  participantInstructions: nullableText(20_000),
  shortRules: nullableText(2_000),
  fullRules: nullableText(20_000),
  longDescription: nullableText(20_000),
  mainImageUrl: optionalUrl,
  mainImageBucket: z.literal("contest-images").nullable().optional(),
  mainImagePath: nullableText(1_000),
  resultImageUrl: optionalUrl,
  resultImageBucket: z.literal("contest-results").nullable().optional(),
  resultImagePath: nullableText(1_000),
  resultText: nullableText(20_000),
  registrationsManuallyClosed: z.boolean().default(false),
  resultPublicationMode: contestResultPublicationModeSchema.default("MANUAL"),
  resultPublishedAt: z.iso.datetime().nullable().optional(),
  secretWeight: z.number().finite().positive().max(1_000_000_000_000).nullable().optional(),
  weightUnit: contestWeightUnitSchema.nullable().optional(),
  customWeightUnit: nullableText(30),
  allowGuessEditing: z.boolean().default(false),
  tieBreakerMode: contestTieBreakerModeSchema.default("MANUAL"),
  notifyTelegramOnPublish: z.boolean().default(false),
  notifyParticipantsOnResult: z.boolean().default(false),
  links: z.array(contestLinkInputSchema).max(20).default([]),
});

function validateContest(
  value: Partial<z.infer<typeof contestFieldsSchema>>,
  context: z.RefinementCtx,
) {
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "La fin doit suivre l’ouverture.",
    });
  }
  const opens = value.registrationStartsAt ?? value.startsAt;
  const closes = value.registrationEndsAt ?? value.endsAt;
  if (opens && closes && new Date(closes) <= new Date(opens)) {
    context.addIssue({
      code: "custom",
      path: ["registrationEndsAt"],
      message: "La fermeture des inscriptions doit suivre leur ouverture.",
    });
  }
  if (value.contestType === "WEIGHT_GUESS") {
    if (!value.secretWeight) {
      context.addIssue({
        code: "custom",
        path: ["secretWeight"],
        message: "Le poids réel est requis.",
      });
    }
    if (!value.weightUnit) {
      context.addIssue({ code: "custom", path: ["weightUnit"], message: "L’unité est requise." });
    }
    if (value.weightUnit === "CUSTOM" && !value.customWeightUnit) {
      context.addIssue({ code: "custom", path: ["customWeightUnit"], message: "Précise l’unité." });
    }
  }
}

export const createContestSchema = contestFieldsSchema.superRefine(validateContest);
export const updateContestSchema = contestFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Aucune modification fournie.")
  .superRefine(validateContest);

export const adminContestsQuerySchema = paginationSchema.extend({
  status: contestStatusSchema.optional(),
  phase: z.enum(["active", "upcoming", "ended", "draft", "all"]).default("all"),
  query: z.string().trim().max(120).optional(),
});
export const adminContestParticipationsQuerySchema = paginationSchema.extend({
  status: contestParticipationStatusSchema.optional(),
  query: z.string().trim().max(120).optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
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
  rank: z.number().int().min(1).max(3).default(1),
  label: nullableText(180),
  prize: jsonObjectSchema.default({}),
  replaceExisting: z.boolean().default(false),
  reason: nullableText(2_000),
});

export const publishContestResultSchema = z.object({
  notifyParticipants: z.boolean().default(false),
});

export const contestEventInputSchema = z.object({
  eventType: z.enum(["PAGE_VIEW", "JOIN_CLICK", "LINK_CLICK"]),
  linkId: z.uuid().optional(),
});
