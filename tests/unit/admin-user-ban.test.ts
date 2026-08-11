import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSqlClient: vi.fn(), tx: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
  getSqlClient: mocks.getSqlClient,
}));

import type { CurrentUser } from "@/lib/auth/current-user";
import { updateAdminUser } from "@/lib/services/admin-users";

const actor: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  telegramId: 6675436692,
  username: "owner",
  displayName: "Propriétaire",
  publicSlug: "proprietaire",
  profilePhotoUrl: null,
  role: "OWNER",
};
const targetId = "22222222-2222-4222-8222-222222222222";

function existing(role: "MEMBER" | "ADMIN" | "BANNED", roleBeforeBan: "MEMBER" | "ADMIN" | null) {
  return {
    id: targetId,
    account_kind: "TELEGRAM",
    is_system: false,
    telegram_id: 123456,
    telegram_username: "target",
    display_name: "Cible",
    public_slug: "cible",
    profile_photo_url: null,
    role,
    experience_points: 0,
    level: 1,
    is_banned: role === "BANNED",
    suspended_at: null,
    suspension_reason: null,
    banned_until: null,
    banned_by_id: null,
    role_before_ban: roleBeforeBan,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    last_seen_at: null,
  };
}

function configureTransaction(target: ReturnType<typeof existing>) {
  mocks.tx.mockImplementation((first: unknown, ...values: unknown[]) => {
    const query = Array.isArray(first) ? first.join("?") : String(first);
    if (/select id,account_kind/i.test(query)) return Promise.resolve([target]);
    if (/update users set/i.test(query)) {
      return Promise.resolve([
        {
          ...target,
          role: "BANNED",
          is_banned: true,
          suspension_reason: values[3],
          banned_until: values[4],
          role_before_ban: target.role,
        },
      ]);
    }
    return Promise.resolve([]);
  });
  mocks.getSqlClient.mockReturnValue({
    begin: (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
  });
}

beforeEach(() => {
  mocks.getSqlClient.mockReset();
  mocks.tx.mockReset();
});

describe("admin user bans", () => {
  it("keeps explicit null as a permanent ban instead of applying the seven-day default", async () => {
    configureTransaction(existing("MEMBER", null));

    const result = await updateAdminUser(
      targetId,
      {
        isBanned: true,
        suspensionReason: "Fraude confirmée",
        suspensionUntil: null,
      },
      actor,
    );

    const updateCall = mocks.tx.mock.calls.find(([first]) =>
      /update users set/i.test(Array.isArray(first) ? first.join("?") : String(first)),
    );
    expect(updateCall?.[5]).toBeNull();
    expect(result.suspensionUntil).toBeNull();
  });

  it("protects the effective pre-ban role from same-level administrators", async () => {
    configureTransaction(existing("BANNED", "ADMIN"));
    const admin = { ...actor, id: "33333333-3333-4333-8333-333333333333", role: "ADMIN" as const };

    await expect(
      updateAdminUser(
        targetId,
        { isBanned: false, restorationReason: "Réactivation demandée" },
        admin,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.tx).toHaveBeenCalledTimes(1);
  });
});
