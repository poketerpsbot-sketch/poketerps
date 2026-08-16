import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ unsafe: vi.fn() }));

vi.mock("@/lib/db", () => ({ getSqlClient: () => ({ unsafe: mocks.unsafe }) }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ APP_TIMEZONE: "Europe/Zurich", SESSION_MAX_DURATION_SECONDS: 43200 }),
}));
vi.mock("@/lib/auth/team-permissions", () => ({
  hasUserPermission: vi.fn(),
  resolvedTeamPermissions: () =>
    Promise.resolve({
      VIEW_ADMIN_ACTIVITY: true,
      VIEW_MODERATOR_ACTIVITY: true,
      VIEW_TEAM_AUDIT_LOG: false,
    }),
}));

import { getTeamActivity } from "@/lib/services/admin-user-insights";

const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  telegramId: 6675436692,
  username: "owner",
  displayName: "Owner",
  publicSlug: "owner",
  profilePhotoUrl: null,
  role: "OWNER" as const,
};

function member(id: string, role: "ADMIN" | "MODERATOR", actions: number) {
  return {
    id,
    display_name: id,
    public_slug: id.toLocaleLowerCase(),
    telegram_username: null,
    profile_photo_url: null,
    role,
    appointed_at: "2026-08-01T00:00:00.000Z",
    last_seen_at: "2026-08-16T00:00:00.000Z",
    is_active_7d: true,
    sessions_7d: 1,
    active_days_7d: 1,
    actions_7d: actions,
    duration_seconds_period: 600,
    sessions_30d: 1,
    active_days_30d: 1,
    actions_30d: actions,
    entries_moderated_7d: id === "Moderator C" ? 1 : id === "Admin A" ? 1 : 0,
    reviews_moderated_7d: id === "Admin A" ? 3 : id === "Moderator C" ? 1 : 0,
    messages_handled_7d: id === "Admin B" ? 2 : 0,
    contest_actions_7d: 0,
    telegram_messages_sent_7d: id === "Admin B" ? 2 : 0,
    entry_approvals_period: 0,
    entry_rejections_period: 0,
    review_approvals_period: 0,
    review_rejections_period: 0,
    contest_decisions_period: 0,
    sanctions_period: 0,
  };
}

beforeEach(() => {
  mocks.unsafe.mockReset();
  mocks.unsafe.mockResolvedValue([
    member("Admin A", "ADMIN", 4),
    member("Admin B", "ADMIN", 2),
    member("Moderator C", "MODERATOR", 2),
  ]);
});

describe("isolation de l'activité équipe", () => {
  it("attribue chaque compteur au userId interne et exclut OWNER par défaut", async () => {
    const result = await getTeamActivity({ days: 7, scope: "all", includeOwner: false }, actor);

    expect(result.members.map(({ id, actions7d }) => [id, actions7d])).toEqual([
      ["Admin A", 4],
      ["Admin B", 2],
      ["Moderator C", 2],
    ]);
    expect(result.ownerIncluded).toBe(false);
    const [query, values] = mocks.unsafe.mock.calls[0] as [string, unknown[]];
    expect(query).toContain("a.actor_user_id=u.id");
    expect(query).toContain("e.admin_id=u.id");
    expect(values[1]).toEqual(["ADMIN", "MODERATOR"]);
  });
});
