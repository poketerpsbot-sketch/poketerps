import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addAdminUserNote: vi.fn(),
  enforceRateLimit: vi.fn(),
  getAdminUserDetail: vi.fn(),
  getTeamActivity: vi.fn(),
  guardBrowserMutation: vi.fn(),
  requireAdminUser: vi.fn(),
  requireUserPermission: vi.fn(),
  sendAdminUserTelegramMessage: vi.fn(),
  updateUserTeamPermission: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({ requireAdminUser: mocks.requireAdminUser }));
vi.mock("@/lib/auth/team-permissions", () => ({
  requireUserPermission: mocks.requireUserPermission,
}));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/security/request-guard", () => ({
  guardBrowserMutation: mocks.guardBrowserMutation,
  rateLimits: { admin: { namespace: "admin", limit: 30, windowSeconds: 60 } },
}));
vi.mock("@/lib/services/admin-user-insights", () => ({
  addAdminUserNote: mocks.addAdminUserNote,
  getAdminUserDetail: mocks.getAdminUserDetail,
  getTeamActivity: mocks.getTeamActivity,
  sendAdminUserTelegramMessage: mocks.sendAdminUserTelegramMessage,
  updateUserTeamPermission: mocks.updateUserTeamPermission,
}));
vi.mock("@/lib/services/admin-users", () => ({ updateAdminUser: vi.fn() }));

import { GET as getTeamActivity } from "@/app/api/admin/team-activity/route";
import { POST as postNote } from "@/app/api/admin/users/[id]/notes/route";
import { GET as getUserDetail } from "@/app/api/admin/users/[id]/route";
import { POST as postTelegramMessage } from "@/app/api/admin/users/[id]/telegram-message/route";
import { PUT as putTeamPermission } from "@/app/api/admin/users/[id]/permissions/route";

const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "OWNER",
  telegramId: 6675436692,
  displayName: "Propriétaire",
};
const targetId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.requireAdminUser.mockResolvedValue(actor);
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.guardBrowserMutation.mockResolvedValue(undefined);
});

describe("admin user and team activity routes", () => {
  it("passes the actor to the protected user dossier service", async () => {
    mocks.getAdminUserDetail.mockResolvedValue({ user: { id: targetId } });
    const response = await getUserDetail(
      new NextRequest(`https://pokedex.example.test/api/admin/users/${targetId}`),
      { params: Promise.resolve({ id: targetId }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.requireAdminUser).toHaveBeenCalledWith();
    expect(mocks.getAdminUserDetail).toHaveBeenCalledWith(targetId, actor);
  });

  it("parses the seven-day scope before loading team activity", async () => {
    mocks.getTeamActivity.mockResolvedValue({ periodDays: 7, members: [] });
    const response = await getTeamActivity(
      new NextRequest(
        "https://pokedex.example.test/api/admin/team-activity?days=7&scope=moderators",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.getTeamActivity).toHaveBeenCalledWith(
      expect.objectContaining({ days: 7, scope: "moderators" }),
      actor,
    );
  });

  it("validates and archives internal notes and Telegram messages", async () => {
    mocks.addAdminUserNote.mockResolvedValue({ id: "note-1" });
    mocks.sendAdminUserTelegramMessage.mockResolvedValue({ id: "message-1", status: "SENT" });
    mocks.updateUserTeamPermission.mockResolvedValue({
      permissionCode: "VIEW_TEAM_AUDIT_LOG",
      override: true,
      effective: true,
    });

    const noteResponse = await postNote(
      new NextRequest(`https://pokedex.example.test/api/admin/users/${targetId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://pokedex.example.test" },
        body: JSON.stringify({ content: "Suivi interne vérifié" }),
      }),
      { params: Promise.resolve({ id: targetId }) },
    );
    const messageResponse = await postTelegramMessage(
      new NextRequest(`https://pokedex.example.test/api/admin/users/${targetId}/telegram-message`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://pokedex.example.test" },
        body: JSON.stringify({ text: "Bonjour depuis PokéTerps" }),
      }),
      { params: Promise.resolve({ id: targetId }) },
    );
    const permissionResponse = await putTeamPermission(
      new NextRequest(`https://pokedex.example.test/api/admin/users/${targetId}/permissions`, {
        method: "PUT",
        headers: { "content-type": "application/json", origin: "https://pokedex.example.test" },
        body: JSON.stringify({ permissionCode: "VIEW_TEAM_AUDIT_LOG", isGranted: true }),
      }),
      { params: Promise.resolve({ id: targetId }) },
    );

    expect(noteResponse.status).toBe(201);
    expect(messageResponse.status).toBe(201);
    expect(permissionResponse.status).toBe(200);
    expect(mocks.addAdminUserNote).toHaveBeenCalledWith(
      targetId,
      "Suivi interne vérifié",
      actor,
      expect.any(String),
    );
    expect(mocks.sendAdminUserTelegramMessage).toHaveBeenCalledWith(
      targetId,
      "Bonjour depuis PokéTerps",
      actor,
      expect.any(String),
    );
    expect(mocks.updateUserTeamPermission).toHaveBeenCalledWith(
      targetId,
      expect.objectContaining({ permissionCode: "VIEW_TEAM_AUDIT_LOG", isGranted: true }),
      actor,
      expect.any(String),
    );
  });
});
