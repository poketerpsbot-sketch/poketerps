import { z } from "zod";

export const updateExperienceRuleSchema = z
  .object({
    label: z.string().trim().min(2).max(120).optional(),
    points: z.coerce.number().int().min(0).max(10_000).optional(),
    description: z.string().trim().max(1_500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Aucune modification fournie.");

export const updateLevelDefinitionSchema = z
  .object({
    threshold: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
    title: z.string().trim().min(2).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Aucune modification fournie.");
