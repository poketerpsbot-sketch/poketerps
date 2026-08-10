import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ getSqlClient: () => sql }));

import { getAdminDashboard } from "@/lib/services/admin";

beforeEach(() => {
  sql.mockReset();
});

describe("admin dashboard statistics", () => {
  it("maps all V1 counters and ranking payloads from one database query", async () => {
    sql.mockResolvedValue([
      {
        total_users: "120",
        active_users: "71",
        new_users_30d: "14",
        members: "117",
        published_entries: "88",
        pending_entries: "4",
        captures_week: "9",
        captures_month: "27",
        total_views: "5000",
        views_today: "63",
        views_30d: "901",
        total_likes: "340",
        total_reviews: "56",
        pending_reviews: "3",
        open_messages: "7",
        unread_messages: "2",
        in_progress_messages: "4",
        active_partners: "6",
        partner_clicks: "432",
        telegram_publications: "22",
        top_trainers: [
          {
            id: "trainer-1",
            public_slug: "ada",
            display_name: "Ada",
            telegram_username: "ada",
            profile_photo_url: null,
            profile_title: "Botaniste",
            level: 7,
            experience_points: "900",
            capture_count: "12",
          },
        ],
        popular_entries: [
          {
            id: "entry-1",
            public_number: "42",
            slug: "fiche-populaire",
            name: "Fiche populaire",
            view_count: "777",
            like_count: "51",
            review_count: "8",
            average_rating: "8.75",
            published_at: "2026-08-01T10:00:00.000Z",
            category_slug: "fleurs",
            category_name: "Fleurs",
          },
        ],
      },
    ]);

    const result = await getAdminDashboard();

    expect(sql).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      totalUsers: 120,
      activeUsers: 71,
      newUsers30d: 14,
      members: 117,
      publishedEntries: 88,
      pendingEntries: 4,
      capturesWeek: 9,
      capturesMonth: 27,
      totalViews: 5000,
      viewsToday: 63,
      views30d: 901,
      totalLikes: 340,
      totalReviews: 56,
      pendingReviews: 3,
      openMessages: 7,
      unreadMessages: 2,
      inProgressMessages: 4,
      activePartners: 6,
      partnerClicks: 432,
      telegramPublications: 22,
    });
    expect(result.topTrainers).toEqual([
      expect.objectContaining({
        id: "trainer-1",
        publicSlug: "ada",
        displayName: "Ada",
        experiencePoints: 900,
        captures: 12,
        captureCount: 12,
      }),
    ]);
    expect(result.popularEntries).toEqual([
      expect.objectContaining({
        id: "entry-1",
        publicNumber: 42,
        slug: "fiche-populaire",
        viewCount: 777,
        metricValue: 777,
        averageRating: 8.75,
        category: { slug: "fleurs", name: "Fleurs" },
      }),
    ]);
  });

  it("uses timezone-safe boundaries and excludes demo/system data from rankings", async () => {
    sql.mockResolvedValue([]);

    const result = await getAdminDashboard();
    const [fragments, timezone] = sql.mock.calls[0] as [TemplateStringsArray, string];
    const statement = fragments.join("$timezone");

    expect(timezone).toBe("Europe/Zurich");
    expect(statement).toContain("date_trunc('day', s.current_time at time zone s.timezone)");
    expect(statement).toContain("date_trunc('week', s.current_time at time zone s.timezone)");
    expect(statement).toContain("date_trunc('month', s.current_time at time zone s.timezone)");
    expect(statement).toContain("from settings s");
    expect(statement.match(/e\.is_demo = false/g)).toHaveLength(4);
    expect(statement).toContain("u.account_kind = 'TELEGRAM' and u.is_system = false");
    expect(statement).toContain(
      "contributor.account_kind = 'TELEGRAM' and contributor.is_system = false",
    );
    expect(statement).toContain("where tp.status = 'PUBLISHED' and tp.published_at is not null");
    expect(result.topTrainers).toEqual([]);
    expect(result.popularEntries).toEqual([]);
    expect(result.totalUsers).toBe(0);
    expect(result.totalViews).toBe(0);
  });
});
