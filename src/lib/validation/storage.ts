import { z } from "zod";

import { uuidSchema } from "@/lib/validation/common";

export const storageBucketSchema = z.enum([
  "entry-images",
  "partner-images",
  "app-assets",
  "message-attachments",
  "contest-images",
  "contest-results",
]);

export const uploadMetadataSchema = z.object({
  bucket: storageBucketSchema,
  relatedId: z
    .union([uuidSchema, z.literal("")])
    .optional()
    .transform((value) => value || undefined),
});
