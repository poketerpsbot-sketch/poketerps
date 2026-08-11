import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sql: vi.fn() }));

vi.mock("@/lib/db", () => ({ getSqlClient: () => mocks.sql }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "Europe/Zurich" }) }));

import type { CurrentUser } from "@/lib/auth/current-user";
import { getAdminUserDetail } from "@/lib/services/admin-user-insights";

const targetId = "11111111-1111-4111-8111-111111111111";
const baseActor: Omit<CurrentUser, "role"> = {
  id: "22222222-2222-4222-8222-222222222222",
  telegramId: 6675436692,
  username: "team",
  displayName: "Équipe",
  publicSlug: "equipe",
  profilePhotoUrl: null,
};

function queryText(first: unknown) {
  return Array.isArray(first) ? first.join("?") : String(first);
}

beforeEach(() => {
  mocks.sql.mockReset();
  mocks.sql.mockImplementation((first: unknown) => {
    const query = queryText(first);
    if (/from users where id=/i.test(query)) {
      return Promise.resolve([
        {
          id: targetId,
          display_name: "Ondine",
          public_slug: "ondine",
          telegram_username: "misty",
          telegram_id: "6675436692",
          profile_photo_url: "https://cdn.example.test/misty.jpg",
          role: "MEMBER",
          role_before_ban: null,
          is_system: false,
          is_banned: false,
          suspended_at: null,
          suspension_reason: null,
          banned_until: null,
          created_at: "2026-08-01T12:00:00.000Z",
          last_seen_at: "2026-08-10T12:00:00.000Z",
          level: 4,
          experience_points: "360",
        },
      ]);
    }
    if (/sessions_7d/i.test(query)) {
      return Promise.resolve([
        {
          sessions_7d: "3",
          sessions_total: "12",
          session_duration_total: "7200",
          session_duration_average: "600",
          session_platforms: [
            { platform: "MINI_APP", sessions: "10", durationSeconds: "6600" },
            { platform: "WEB", sessions: "2", durationSeconds: "600" },
          ],
          active_days_7d: "2",
          actions_7d: "18",
          entries_created: "8",
          entries_submitted: "7",
          entries_approved: "5",
          entries_rejected: "1",
          reviews_submitted: "6",
          reviews_approved: "4",
          reviews_rejected: "1",
          likes_given: "9",
          likes_received: "11",
          favorites_saved: "3",
          favorites_received: "7",
          views_received: "120",
          messages_sent: "2",
          reports_sent: "1",
          contest_participations: "2",
          entries_moderated: "0",
          reviews_moderated: "0",
          contests_moderated: "0",
          telegram_messages_sent: "0",
        },
      ]);
    }
    if (/with boundaries/i.test(query)) {
      return Promise.resolve([
        { weekly_rank: "2", monthly_rank: "4", general_rank: "8", captures_rank: "6" },
      ]);
    }
    return Promise.resolve([]);
  });
});

describe("admin user dossier insights", () => {
  it("exposes Telegram ID only to OWNER and returns the complete PokéTerps analytics", async () => {
    const ownerDetail = await getAdminUserDetail(targetId, { ...baseActor, role: "OWNER" });
    const adminDetail = await getAdminUserDetail(targetId, { ...baseActor, role: "ADMIN" });

    expect(ownerDetail.user).toEqual(
      expect.objectContaining({
        telegramId: 6675436692,
        firstInteractionAt: "2026-08-01T12:00:00.000Z",
      }),
    );
    expect(adminDetail.user).not.toHaveProperty("telegramId");
    expect(ownerDetail.stats).toEqual(
      expect.objectContaining({
        sessionsTotal: 12,
        sessionDurationTotalSeconds: 7200,
        sessionDurationAverageSeconds: 600,
        entriesSubmitted: 7,
        entriesApproved: 5,
        entriesRejected: 1,
        reviewsSubmitted: 6,
        reviewsApproved: 4,
        reviewsRejected: 1,
        likesGiven: 9,
        likesReceived: 11,
        favoritesSaved: 3,
        favoritesReceived: 7,
        messagesSent: 2,
        reportsSent: 1,
        contestParticipations: 2,
      }),
    );
    expect(ownerDetail.stats.sessionPlatforms).toEqual([
      { platform: "MINI_APP", sessions: 10, durationSeconds: 6600 },
      { platform: "WEB", sessions: 2, durationSeconds: 600 },
    ]);
    expect(ownerDetail.rankings).toEqual({ weekly: 2, monthly: 4, general: 8, captures: 6 });
  });
});
