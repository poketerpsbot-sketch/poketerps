import { z } from "zod";

export const telegramLoginSchema = z.object({
  initData: z.string().min(1).max(10_000),
});
