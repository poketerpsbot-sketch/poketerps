import { z } from "zod";

import { paginationSchema } from "@/lib/validation/common";

export const trainerRankingQuerySchema = paginationSchema.extend({
  period: z.enum(["week", "month", "all"]).default("week"),
});

export const entryRankingQuerySchema = paginationSchema.extend({
  period: z.enum(["week", "month", "all"]).default("week"),
  metric: z.enum(["views", "likes", "rating", "recent"]).default("views"),
});
