import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyTelegramInitData } from "@/lib/auth/telegram";

const botToken = process.env.TELEGRAM_BOT_TOKEN!;

function signedInitData(now: Date, overrides: Record<string, string> = {}) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(now.getTime() / 1_000)),
    query_id: "AAE-test-query",
    user: JSON.stringify({
      id: 123_456_789,
      first_name: "Alice",
      last_name: "Test",
      username: "alice_test",
    }),
    ...overrides,
  });
  const check = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return params.toString();
}

describe("verifyTelegramInitData", () => {
  const now = new Date("2026-08-09T18:00:00.000Z");

  it("accepts a correctly signed, fresh payload", () => {
    const result = verifyTelegramInitData(signedInitData(now), now);

    expect(result.user).toMatchObject({
      id: 123_456_789,
      first_name: "Alice",
      username: "alice_test",
    });
    expect(result.queryId).toBe("AAE-test-query");
  });

  it("rejects a forged signature", () => {
    const params = new URLSearchParams(signedInitData(now));
    params.set("hash", "0".repeat(64));

    expect(() => verifyTelegramInitData(params.toString(), now)).toThrowError(
      expect.objectContaining({ code: "INVALID_TELEGRAM_SIGNATURE", status: 401 }),
    );
  });

  it("rejects an expired payload", () => {
    const oldAuthDate = String(Math.floor(now.getTime() / 1_000) - 301);

    expect(() =>
      verifyTelegramInitData(signedInitData(now, { auth_date: oldAuthDate }), now),
    ).toThrowError(expect.objectContaining({ code: "EXPIRED_TELEGRAM_INIT_DATA" }));
  });

  it("rejects ambiguous duplicate parameters", () => {
    const raw = `${signedInitData(now)}&query_id=duplicate`;

    expect(() => verifyTelegramInitData(raw, now)).toThrowError(
      expect.objectContaining({ code: "INVALID_TELEGRAM_INIT_DATA" }),
    );
  });
});
