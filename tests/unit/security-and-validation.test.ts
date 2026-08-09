import { describe, expect, it } from "vitest";

import {
  DEVELOPMENT_ANONYMOUS_COOKIE_NAME,
  PRODUCTION_ANONYMOUS_COOKIE_NAME,
  anonymousCookieName,
} from "@/lib/auth/anonymous";
import {
  DEVELOPMENT_SESSION_COOKIE_NAME,
  PRODUCTION_SESSION_COOKIE_NAME,
  sessionCookieName,
} from "@/lib/auth/session";
import { isValidTelegramWebhookSecret } from "@/lib/auth/telegram-webhook";
import { createEntrySchema } from "@/lib/validation/entries";

describe("security helpers", () => {
  it("uses __Host cookies only when Secure is guaranteed", () => {
    expect(sessionCookieName("production")).toBe(PRODUCTION_SESSION_COOKIE_NAME);
    expect(sessionCookieName("development")).toBe(DEVELOPMENT_SESSION_COOKIE_NAME);
    expect(anonymousCookieName("production")).toBe(PRODUCTION_ANONYMOUS_COOKIE_NAME);
    expect(anonymousCookieName("test")).toBe(DEVELOPMENT_ANONYMOUS_COOKIE_NAME);
  });

  it("compares Telegram webhook secrets exactly", () => {
    expect(isValidTelegramWebhookSecret("secret_123", "secret_123")).toBe(true);
    expect(isValidTelegramWebhookSecret("secret_124", "secret_123")).toBe(false);
    expect(isValidTelegramWebhookSecret(null, "secret_123")).toBe(false);
  });
});

describe("entry validation", () => {
  const base = {
    name: "Test",
    categoryId: "550e8400-e29b-41d4-a716-446655440000",
    rarity: "UNKNOWN",
    fields: {},
    tagIds: [],
  };

  it("accepts the frontend V1 contract", () => {
    expect(createEntrySchema.safeParse({ ...base, micron: null }).success).toBe(true);
  });

  it("rejects inverted micron ranges", () => {
    const result = createEntrySchema.safeParse({
      ...base,
      micron: {
        mode: "RANGE",
        minimumValue: 160,
        maximumValue: 90,
        multipleValues: [],
        sourceType: "DECLARED",
      },
    });
    expect(result.success).toBe(false);
  });
});
