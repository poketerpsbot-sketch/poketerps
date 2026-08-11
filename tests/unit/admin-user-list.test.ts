import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSqlClient: vi.fn(),
  unsafe: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
  getSqlClient: mocks.getSqlClient,
}));

import { listAdminUsers } from "@/lib/services/admin-users";

const userId = "11111111-1111-4111-8111-111111111111";
const actor = {
  id: "22222222-2222-4222-8222-222222222222",
  telegramId: 6675436692,
  username: "owner",
  displayName: "Propriétaire",
  publicSlug: "proprietaire",
  profilePhotoUrl: null,
  role: "OWNER" as const,
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  const row = {
    id: userId,
    accountKind: "TELEGRAM",
    isSystem: false,
    telegramUsername: "misty",
    displayName: "Misty",
    publicSlug: "misty",
    profilePhotoUrl: "https://cdn.example.test/misty.jpg",
    role: "MEMBER" as const,
    experiencePoints: 140,
    level: 3,
    isBanned: false,
    suspendedAt: null,
    suspensionReason: null,
    suspensionUntil: null,
    bannedById: null,
    roleBeforeBan: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-10T00:00:00Z"),
    lastSeenAt: new Date("2026-08-10T12:00:00Z"),
  };
  mocks.getDb.mockReturnValue({
    select: vi.fn((selection: Record<string, unknown>) =>
      "total" in selection
        ? {
            from: () => ({ where: async () => [{ total: 1 }] }),
          }
        : {
            from: () => ({
              where: () => ({
                orderBy: () => ({ limit: () => ({ offset: async () => [row] }) }),
              }),
            }),
          },
    ),
  });
  mocks.getSqlClient.mockReturnValue({ unsafe: mocks.unsafe });
  mocks.unsafe.mockResolvedValue([
    {
      user_id: userId,
      capture_count: "12",
      review_count: "7",
      badge_id: "33333333-3333-4333-8333-333333333333",
      badge_slug: "champion",
      badge_name: "Championne",
      badge_icon: "🏆",
    },
  ]);
});

describe("admin user list enrichment", () => {
  it("returns the avatar, validated contribution counts and featured active badge", async () => {
    const result = await listAdminUsers({ limit: 100, offset: 0 }, actor);

    expect(mocks.unsafe).toHaveBeenCalledWith(
      expect.stringMatching(/from entries[\s\S]*from reviews[\s\S]*from user_badges/i),
      [[userId]],
    );
    expect(result.users).toEqual([
      expect.objectContaining({
        id: userId,
        profilePhotoUrl: "https://cdn.example.test/misty.jpg",
        captureCount: 12,
        reviewCount: 7,
        badge: {
          id: "33333333-3333-4333-8333-333333333333",
          slug: "champion",
          name: "Championne",
          icon: "🏆",
        },
        canManage: true,
      }),
    ]);
  });
});
