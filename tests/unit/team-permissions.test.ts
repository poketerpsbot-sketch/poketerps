import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));

vi.mock("@/lib/db", () => ({ getSqlClient: () => mocks.sql }));

import { hasUserPermission, resolvedTeamPermissions } from "@/lib/auth/team-permissions";

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.sql.mockResolvedValue([]);
});

describe("team activity permission resolution", () => {
  it("gives the owner all three team permissions without querying an override", async () => {
    await expect(
      resolvedTeamPermissions({ id: "11111111-1111-4111-8111-111111111111", role: "OWNER" }),
    ).resolves.toEqual({
      VIEW_ADMIN_ACTIVITY: true,
      VIEW_MODERATOR_ACTIVITY: true,
      VIEW_TEAM_AUDIT_LOG: true,
    });
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("keeps the administrator default limited to moderator activity", async () => {
    const actor = { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN" as const };
    await expect(hasUserPermission(actor, "VIEW_ADMIN_ACTIVITY")).resolves.toBe(false);
    await expect(hasUserPermission(actor, "VIEW_MODERATOR_ACTIVITY")).resolves.toBe(true);
    await expect(hasUserPermission(actor, "VIEW_TEAM_AUDIT_LOG")).resolves.toBe(false);
  });

  it("honours an explicit denial before the role default", async () => {
    mocks.sql.mockResolvedValue([{ is_granted: false }]);
    await expect(
      hasUserPermission(
        { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN" },
        "VIEW_MODERATOR_ACTIVITY",
      ),
    ).resolves.toBe(false);
  });
});
