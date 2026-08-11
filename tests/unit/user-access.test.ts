import { describe, expect, it } from "vitest";

import { banAccessDecision } from "@/lib/auth/user-access";

describe("temporary user bans", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");

  it("blocks permanent and not-yet-expired suspensions", () => {
    expect(
      banAccessDecision(
        {
          role: "BANNED",
          isBanned: true,
          suspendedAt: "2026-08-10T12:00:00.000Z",
          bannedUntil: null,
        },
        now,
      ),
    ).toBe("BLOCK");
    expect(
      banAccessDecision(
        {
          role: "BANNED",
          isBanned: true,
          suspendedAt: "2026-08-10T12:00:00.000Z",
          bannedUntil: "2026-08-12T12:00:00.000Z",
        },
        now,
      ),
    ).toBe("BLOCK");
  });

  it("requests an atomic restoration only after a temporary ban expires", () => {
    expect(
      banAccessDecision(
        {
          role: "BANNED",
          isBanned: true,
          suspendedAt: "2026-08-09T12:00:00.000Z",
          bannedUntil: "2026-08-11T11:59:59.000Z",
        },
        now,
      ),
    ).toBe("EXPIRE");
  });

  it("does not block a clean account because an old expiry value remains", () => {
    expect(
      banAccessDecision(
        {
          role: "MEMBER",
          isBanned: false,
          suspendedAt: null,
          bannedUntil: "2026-08-10T12:00:00.000Z",
        },
        now,
      ),
    ).toBe("ALLOW");
  });
});
