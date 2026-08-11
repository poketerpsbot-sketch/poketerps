import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getSqlClient: () => mocks.sql }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mocks.warn } }));

import {
  recordUserActivityEvent,
  recordUserSession,
  tryRecordUserActivityEvent,
} from "@/lib/services/user-activity";

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.warn.mockReset();
});

describe("PokéTerps activity events", () => {
  it("deduplicates APP_OPEN for a reused PokéTerps session", async () => {
    mocks.sql.mockResolvedValueOnce([{ id: "session-1" }]).mockResolvedValueOnce([]);
    await recordUserSession({
      userId: "11111111-1111-4111-8111-111111111111",
      clientSessionId: "mini-app-session-1",
      platform: "MINI_APP",
    });
    const eventSql = mocks.sql.mock.calls[1]?.[0] as TemplateStringsArray;
    expect(eventSql.join(" ")).toContain("where not exists");
    expect(eventSql.join(" ")).toContain("event_type='APP_OPEN'");
  });

  it("stores an event and its entity without external Telegram presence data", async () => {
    mocks.sql.mockResolvedValue([{ id: "event-1" }]);
    await expect(
      recordUserActivityEvent({
        userId: "11111111-1111-4111-8111-111111111111",
        eventType: "ENTRY_VIEW",
        entityType: "ENTRY",
        entityId: "22222222-2222-4222-8222-222222222222",
        metadata: { counted: true },
      }),
    ).resolves.toBe("event-1");

    const sqlFragments = mocks.sql.mock.calls[0]?.[0] as TemplateStringsArray;
    expect(sqlFragments.join(" ")).toContain("insert into user_activity_events");
    expect(sqlFragments.join(" ")).toContain("user_sessions");
  });

  it("keeps analytics failure from breaking the user action", async () => {
    mocks.sql.mockRejectedValue(new Error("analytics unavailable"));
    await expect(
      tryRecordUserActivityEvent({
        userId: "11111111-1111-4111-8111-111111111111",
        eventType: "SEARCH",
      }),
    ).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalledWith(
      "user_activity_event_failed",
      expect.objectContaining({ eventType: "SEARCH" }),
    );
  });
});
