import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rawSql = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ getSqlClient: () => rawSql }));

import { enforceRateLimit } from "@/lib/security/rate-limit";

beforeEach(() => {
  rawSql.mockReset();
  rawSql.mockResolvedValue([{ request_count: 1 }]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-10T00:01:23.456Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rate-limit raw SQL parameters", () => {
  it("serializes timestamps to ISO strings before passing them to postgres.js", async () => {
    const result = await enforceRateLimit(
      { namespace: "telegram-auth", limit: 5, windowSeconds: 60 },
      "request-fingerprint",
    );

    expect(rawSql).toHaveBeenCalledTimes(1);
    const [fragments, keyHash, windowStartedAt, expiresAt] = rawSql.mock.calls[0] as [
      TemplateStringsArray,
      string,
      unknown,
      unknown,
    ];

    expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(windowStartedAt).toBe("2026-08-10T00:01:00.000Z");
    expect(expiresAt).toBe("2026-08-10T00:03:00.000Z");
    expect([keyHash, windowStartedAt, expiresAt].some((value) => value instanceof Date)).toBe(
      false,
    );
    expect(fragments.join("$value")).toContain("$value::timestamptz");
    expect(result).toEqual({
      remaining: 4,
      resetAt: new Date("2026-08-10T00:02:00.000Z"),
    });
  });
});
