import { beforeEach, describe, expect, it, vi } from "vitest";

const unsafe = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ getSqlClient: () => ({ unsafe }) }));
vi.mock("@/lib/services/storage-url", () => ({
  publicStorageUrl: (bucket: string, path: string | null) =>
    path ? "https://storage.test/" + bucket + "/" + path : null,
}));

import { getEntryRankingPage, getTrainerRankingPage } from "@/lib/services/rankings";

beforeEach(() => {
  unsafe.mockReset();
});

describe("competitive rankings", () => {
  it("ranks public Telegram users from real entries and maps engagement, XP and personal rank", async () => {
    const raw = {
      rank: 4,
      user_id: "00000000-0000-4000-8000-000000000004",
      slug: "nico",
      display_name: "Nico",
      username: "nico_tg",
      profile_photo_url: "https://t.me/avatar.jpg",
      profile_title: "Explorateur",
      level: 8,
      experience_points: "1250",
      period_captures: 3,
      total_captures: 12,
      period_likes_received: 9,
      total_likes_received: 40,
      period_views_received: 120,
      total_views_received: 900,
      badge_id: "00000000-0000-4000-8000-000000000010",
      badge_slug: "pionnier",
      badge_name: "Pionnier",
      badge_icon: "◆",
      badge_image_url: "/badges/level-5.png",
      badge_category: "LEVEL",
      badge_rarity: "UNCOMMON",
    };
    unsafe.mockResolvedValue([{ items: [raw], total: 52, current_user: raw }]);

    const result = await getTrainerRankingPage("month", 20, 20, raw.user_id);
    const [statement, args] = unsafe.mock.calls[0] as [string, unknown[]];

    expect(args).toEqual(["month", "Europe/Zurich", 20, 20, raw.user_id]);
    expect(statement).toContain("e.is_demo=false");
    expect(statement).toContain("contributor.account_kind='TELEGRAM'");
    expect(statement).toContain("contributor.is_system=false");
    expect(statement).toContain("u.profile_visibility='PUBLIC'");
    expect(statement).toContain("u.is_banned=false");
    expect(statement).toContain("like_stats as");
    expect(statement).toContain("view_stats as");
    expect(statement).toContain("period_captures desc, period_likes_received desc");
    expect(statement).toContain("where user_id=$5::uuid");
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          rank: 4,
          publicSlug: "nico",
          captures: 3,
          totalCaptures: 12,
          likesReceived: 9,
          viewsReceived: 120,
          experiencePoints: 1250,
          badge: expect.objectContaining({
            name: "Pionnier",
            imageUrl: "/badges/level-5.png",
            category: "LEVEL",
            rarity: "UNCOMMON",
          }),
        }),
      ],
      total: 52,
      currentUser: expect.objectContaining({ rank: 4, publicSlug: "nico" }),
    });
  });

  it("excludes demo entries and system contributors from every entry score", async () => {
    unsafe.mockResolvedValue([
      {
        items: [
          {
            rank: 1,
            id: "00000000-0000-4000-8000-000000000021",
            public_number: 21,
            slug: "fiche-reelle",
            name: "Fiche réelle",
            average_rating: "8.75",
            view_count: 300,
            like_count: 25,
            review_count: 7,
            published_at: "2026-08-09T12:00:00.000Z",
            category_slug: "fleurs",
            category_name: "Fleurs",
            primary_image_path: "entries/21.webp",
            metric_value: 120,
          },
        ],
        total: 1,
      },
    ]);

    const result = await getEntryRankingPage("views", "week", 20, 0);
    const [statement, args] = unsafe.mock.calls[0] as [string, unknown[]];

    expect(args).toEqual(["week", "Europe/Zurich", 20, 0]);
    expect(statement).toContain("e.is_demo=false");
    expect(statement).toContain("contributor.account_kind='TELEGRAM'");
    expect(statement).toContain("contributor.is_system=false");
    expect(statement).toContain("contributor.profile_visibility='PUBLIC'");
    expect(statement).toContain("(select count(*)::int from ranked) total");
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          rank: 1,
          publicNumber: 21,
          metricValue: 120,
          primaryImageUrl: "https://storage.test/entry-images/entries/21.webp",
        }),
      ],
      total: 1,
    });
  });
});
