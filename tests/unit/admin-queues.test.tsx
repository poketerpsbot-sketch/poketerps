import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.hoisted(() => vi.fn());
const navigation = vi.hoisted(() => ({ pathname: "/admin/moderation" }));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(), getSqlClient: () => sql }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { AdminNav } from "@/components/admin/admin-nav";
import type { CurrentUser } from "@/lib/auth/current-user";
import { getAdminQueueCounts } from "@/lib/services/admin-queues";

const moderator: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  telegramId: 42,
  username: "moderator",
  displayName: "Modération",
  publicSlug: "moderation",
  profilePhotoUrl: null,
  role: "MODERATOR",
};

beforeEach(() => {
  sql.mockReset();
  navigation.pathname = "/admin/moderation";
});

describe("admin moderation queues", () => {
  it("maps exact actionable and waiting counts from one query", async () => {
    sql.mockResolvedValue([
      {
        pending_entries: "2",
        pending_corrections: "3",
        pending_reviews: "4",
        pending_messages: "5",
        pending_reports: "1",
        pending_contest_participations: "2",
        requested_entry_changes: "6",
        requested_review_changes: "7",
      },
    ]);

    const result = await getAdminQueueCounts(moderator);

    expect(sql).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      pendingEntries: 2,
      pendingCorrections: 3,
      pendingReviews: 4,
      pendingMessages: 5,
      pendingReports: 1,
      pendingContestParticipations: 2,
      requestedEntryChanges: 6,
      requestedReviewChanges: 7,
      totalActionable: 17,
    });
  });

  it("does not query or expose queue counts to a member", async () => {
    const result = await getAdminQueueCounts({ ...moderator, role: "MEMBER" });

    expect(sql).not.toHaveBeenCalled();
    expect(result.totalActionable).toBe(0);
  });

  it("shows compact badges only on accessible moderation links", () => {
    const markup = renderToStaticMarkup(
      <AdminNav
        role="MODERATOR"
        canViewTeamActivity={false}
        queueCounts={{
          pendingEntries: 2,
          pendingCorrections: 1,
          pendingReviews: 4,
          pendingMessages: 5,
          pendingReports: 2,
          pendingContestParticipations: 3,
          requestedEntryChanges: 0,
          requestedReviewChanges: 0,
          totalActionable: 17,
        }}
      />,
    );

    expect(markup).toContain('aria-label="17 éléments en attente"');
    expect(markup).toContain('href="/admin/fiches"');
    expect(markup).toContain(">3</span>");
    expect(markup).not.toContain('href="/admin/parametres"');
  });
});
