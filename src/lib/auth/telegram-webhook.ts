import { timingSafeEqual } from "node:crypto";

export function isValidTelegramWebhookSecret(supplied: string | null, expected: string): boolean {
  if (!supplied) return false;
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes)
  );
}
