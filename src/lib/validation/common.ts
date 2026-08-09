import { z } from "zod";

const stripUnsafeControlCharacters = (value: string) =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

export const uuidSchema = z.uuid();
export const idOrSlugSchema = z.union([
  z.uuid(),
  z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
]);
export const shortTextSchema = z
  .string()
  .transform(stripUnsafeControlCharacters)
  .pipe(z.string().min(1).max(180));
export const longTextSchema = z
  .string()
  .transform(stripUnsafeControlCharacters)
  .pipe(z.string().min(1).max(10_000));
export const optionalLongTextSchema = z
  .string()
  .transform(stripUnsafeControlCharacters)
  .pipe(z.string().max(20_000))
  .optional();

export const safeExternalUrlSchema = z
  .url()
  .max(2_000)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "Seules les URL HTTP(S) sont autorisées.");

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
  return slug || "capture";
}
