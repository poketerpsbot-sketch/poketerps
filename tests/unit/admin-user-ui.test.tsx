import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AdminUserDetail } from "@/components/admin/admin-user-detail";
import type { AdminUserDetailDto } from "@/components/admin/user-activity-types";

const detail: AdminUserDetailDto = {
  user: {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "Dresseuse Test",
    publicSlug: "dresseuse-test",
    telegramUsername: "dresseuse",
    profilePhotoUrl: null,
    role: "ADMIN",
    isSystem: false,
    isBanned: false,
    suspendedAt: null,
    suspensionReason: null,
    suspensionUntil: null,
    createdAt: "2026-08-01T12:00:00.000Z",
    firstInteractionAt: "2026-08-01T12:00:00.000Z",
    appointedAt: "2026-08-02T12:00:00.000Z",
    lastSeenAt: "2026-08-11T12:00:00.000Z",
    level: 3,
    experiencePoints: 120,
  },
  stats: {
    sessions7d: 4,
    sessions30d: 10,
    sessionsTotal: 12,
    sessionDurationTotalSeconds: 7_200,
    sessionDurationAverageSeconds: 600,
    sessionPlatforms: [
      { platform: "MINI_APP", sessions: 10, durationSeconds: 6_000 },
      { platform: "WEB", sessions: 2, durationSeconds: 1_200 },
    ],
    activeDays7d: 3,
    activeDays30d: 8,
    actions7d: 12,
    actions30d: 30,
    entriesCreated: 2,
    entriesSubmitted: 2,
    entriesApproved: 1,
    entriesRejected: 1,
    reviewsSubmitted: 3,
    reviewsApproved: 2,
    reviewsRejected: 1,
    likesGiven: 5,
    likesReceived: 8,
    favoritesSaved: 4,
    favoritesReceived: 6,
    viewsReceived: 42,
    messagesSent: 1,
    reportsSent: 1,
    contestParticipations: 2,
    entriesModerated: 0,
    reviewsModerated: 0,
    contestsModerated: 0,
    telegramMessagesSent: 1,
    entryApprovals30d: 4,
    entryRejections30d: 1,
    reviewApprovals30d: 7,
    reviewRejections30d: 2,
    contestDecisions30d: 3,
    sanctions30d: 1,
  },
  rankings: { weekly: 2, monthly: 4, general: 8, captures: 6 },
  sessions: [
    {
      id: "session-1",
      platform: "MINI_APP",
      startedAt: "2026-08-11T11:30:00.000Z",
      lastActivityAt: "2026-08-11T12:00:00.000Z",
      endedAt: null,
      durationSeconds: 1800,
      appVersion: null,
    },
  ],
  activity: [],
  notes: [],
  roleHistory: [],
  sanctions: [],
  telegramMessages: [],
  canManageAccount: true,
  canManageTeamPermissions: true,
  teamPermissions: [
    {
      permissionCode: "VIEW_ADMIN_ACTIVITY",
      override: null,
      effective: false,
      expiresAt: null,
    },
    {
      permissionCode: "VIEW_MODERATOR_ACTIVITY",
      override: null,
      effective: true,
      expiresAt: null,
    },
    {
      permissionCode: "VIEW_TEAM_AUDIT_LOG",
      override: true,
      effective: true,
      expiresAt: null,
    },
  ],
};

describe("admin user dossier UI", () => {
  it("renders mobile-friendly account, session, note and Telegram controls", () => {
    const markup = renderToStaticMarkup(<AdminUserDetail initialDetail={detail} />);
    expect(markup).toContain("Dresseuse Test");
    expect(markup).toContain("Sessions (7 j)");
    expect(markup).toContain("Mini App Telegram");
    expect(markup).toContain("Durée moyenne");
    expect(markup).toContain("Fiches validées");
    expect(markup).toContain("Avis refusés");
    expect(markup).toContain("#2");
    expect(markup).toContain("Ajouter une note");
    expect(markup).toContain("Envoyer et archiver");
    expect(markup).toContain("Date personnalisée");
    expect(markup).toContain("Permanent");
    expect(markup).toContain("Délégation de l’activité d’équipe");
    expect(markup).toContain("Voir le journal détaillé de l’équipe");
    expect(markup).toContain("Aucune activité Telegram extérieure");
    expect(markup).not.toContain("6675436692");
  });

  it("shows the Telegram identifier only when the owner-scoped DTO contains it", () => {
    const markup = renderToStaticMarkup(
      <AdminUserDetail
        initialDetail={{ ...detail, user: { ...detail.user, telegramId: 6_675_436_692 } }}
      />,
    );
    expect(markup).toContain("ID Telegram");
    expect(markup).toContain("6675436692");
    expect(markup).toContain("visible uniquement par le propriétaire");
  });
});
