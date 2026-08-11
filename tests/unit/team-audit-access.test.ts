import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permissions: vi.fn(),
  unsafe: vi.fn(),
}));

vi.mock("@/lib/auth/team-permissions", () => ({
  hasUserPermission: vi.fn(),
  resolvedTeamPermissions: mocks.permissions,
}));
vi.mock("@/lib/db", () => ({
  getSqlClient: () => ({ unsafe: mocks.unsafe }),
}));

import type { CurrentUser } from "@/lib/auth/current-user";
import { getTeamAuditLog, listTeamAuditLogs } from "@/lib/services/admin-user-insights";

const actor: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  telegramId: 42,
  username: "moderator",
  displayName: "Moderator",
  publicSlug: "moderator",
  profilePhotoUrl: null,
  role: "MODERATOR",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unsafe.mockResolvedValue([]);
});

describe("team audit role boundaries", () => {
  it("filters a detailed journal to the independently authorised role scopes", async () => {
    mocks.permissions.mockResolvedValue({
      VIEW_TEAM_AUDIT_LOG: true,
      VIEW_ADMIN_ACTIVITY: false,
      VIEW_MODERATOR_ACTIVITY: true,
    });

    await listTeamAuditLogs({ days: 7, limit: 20, offset: 0 }, actor);

    expect(mocks.unsafe).toHaveBeenCalledWith(expect.any(String), [
      ["MODERATOR"],
      7,
      null,
      null,
      null,
      20,
      0,
    ]);
  });

  it("does not expose an OWNER or ADMIN detail without VIEW_ADMIN_ACTIVITY", async () => {
    mocks.permissions.mockResolvedValue({
      VIEW_TEAM_AUDIT_LOG: true,
      VIEW_ADMIN_ACTIVITY: false,
      VIEW_MODERATOR_ACTIVITY: true,
    });

    await expect(
      getTeamAuditLog("22222222-2222-4222-8222-222222222222", actor),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.unsafe).toHaveBeenCalledWith(expect.any(String), [
      "22222222-2222-4222-8222-222222222222",
      ["MODERATOR"],
    ]);
  });

  it("rejects audit access when no activity scope is granted", async () => {
    mocks.permissions.mockResolvedValue({
      VIEW_TEAM_AUDIT_LOG: true,
      VIEW_ADMIN_ACTIVITY: false,
      VIEW_MODERATOR_ACTIVITY: false,
    });

    await expect(listTeamAuditLogs({ days: 7, limit: 20, offset: 0 }, actor)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    expect(mocks.unsafe).not.toHaveBeenCalled();
  });
});
