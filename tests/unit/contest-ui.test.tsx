import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminContestManager } from "@/components/contests/admin-contest-manager";
import { ContestCard } from "@/components/contests/contest-card";
import { ContestLeaderboard } from "@/components/contests/contest-leaderboard";
import { ContestParticipationPanel } from "@/components/contests/contest-participation";
import type { AdminContest, ContestCardData, ContestDetailData } from "@/components/contests/types";
import { adminContestValue } from "@/components/contests/contest-utils";

const card: ContestCardData = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "defi-aout",
  title: "Défi du mois",
  summary: "Présente ta meilleure fiche.",
  imageUrl: null,
  status: "ACTIVE",
  phase: "ACTIVE",
  isFeatured: true,
  startsAt: "2026-08-01T10:00:00.000Z",
  endsAt: "2026-08-31T20:00:00.000Z",
  scoringMode: "ENTRY_LIKES",
  reward: { title: "Badge Champion" },
  participantCount: 12,
  maxParticipants: 100,
  remainingParticipants: 88,
  isFull: false,
  registrationsOpen: true,
  contestType: "ENTRY",
  participationOpen: true,
};

const detail: ContestDetailData = {
  ...card,
  description: "Un défi ouvert à tous.",
  rules: "Une fiche personnelle publiée.",
  criteria: {},
  rewardBadge: null,
  requireEntry: true,
  instructions: "Rejoins le canal puis ouvre le lien.",
  participationSteps: ["Rejoins le canal", "Ouvre le lien"],
  externalUrl: "https://example.com/participer",
  telegramUrl: null,
  instagramUrl: null,
  terms: "Compte PokéTerps actif et une seule participation.",
  additionalInformation: "Le jury annoncera le résultat dans le canal officiel.",
  registrationStartsAt: null,
  registrationEndsAt: null,
  winners: [],
  viewerParticipation: null,
};

const adminContest: AdminContest = {
  ...card,
  description: detail.description,
  rules: detail.rules,
  criteria: {},
  rewardBadgeId: null,
  maxParticipants: 100,
  requireEntry: true,
  instructions: detail.instructions,
  participationSteps: detail.participationSteps,
  externalUrl: detail.externalUrl,
  telegramUrl: detail.telegramUrl,
  instagramUrl: detail.instagramUrl,
  terms: detail.terms,
  additionalInformation: detail.additionalInformation,
  registrationsOpen: true,
  registrationStartsAt: null,
  registrationEndsAt: null,
  participantCount: 12,
  pendingCount: 3,
};

describe("contest public UI", () => {
  it("shows phase, reward, participant count and the public detail link", () => {
    const markup = renderToStaticMarkup(<ContestCard contest={card} />);

    expect(markup).toContain('href="/concours/defi-aout"');
    expect(markup).toContain("En cours");
    expect(markup).toContain("Badge Champion");
    expect(markup).toContain("12 / 100 participants");
    expect(markup).toContain("Participer");
  });

  it("renders a clear Telegram login prompt when the visitor is not authenticated", () => {
    const markup = renderToStaticMarkup(
      <ContestParticipationPanel initialContest={detail} initiallyAuthenticated={false} />,
    );

    expect(markup).toContain("Connexion Telegram nécessaire");
    expect(markup).not.toContain("Participer au concours");
  });

  it("renders the entry selector for an authenticated contest requiring a capture", () => {
    const markup = renderToStaticMarkup(
      <ContestParticipationPanel
        initialContest={detail}
        initiallyAuthenticated
        initialEntries={[{ id: "entry-1", slug: "ma-fiche", name: "Ma fiche" }]}
      />,
    );

    expect(markup).toContain("Fiche publiée");
    expect(markup).toContain("Ma fiche");
    expect(markup).toContain("Participer au concours");
  });

  it("keeps every configured instruction visible after participation", () => {
    const markup = renderToStaticMarkup(
      <ContestParticipationPanel
        initialContest={{
          ...detail,
          viewerParticipation: {
            id: "22222222-2222-4222-8222-222222222222",
            contestId: detail.id,
            entryId: "entry-1",
            status: "PENDING_REVIEW",
            statement: null,
            submittedAt: "2026-08-10T10:00:00.000Z",
            updatedAt: "2026-08-10T10:00:00.000Z",
            withdrawnAt: null,
          },
        }}
        initiallyAuthenticated
      />,
    );

    expect(markup).toContain("Voici les marches à suivre");
    expect(markup).toContain("Rejoins le canal");
    expect(markup).toContain("Explication du concours");
    expect(markup).toContain("Informations complémentaires");
    expect(markup).toContain("Règlement");
    expect(markup).toContain("Conditions");
    expect(markup).toContain("Fin du concours");
    expect(markup).toContain("Ouvrir le lien");
  });

  it("keeps a full contest visible and disables the participation call to action", () => {
    const full = {
      ...detail,
      participantCount: 50,
      maxParticipants: 50,
      remainingParticipants: 0,
      isFull: true,
      participationOpen: false,
    };
    const cardMarkup = renderToStaticMarkup(<ContestCard contest={full} />);
    const panelMarkup = renderToStaticMarkup(
      <ContestParticipationPanel initialContest={full} initiallyAuthenticated />,
    );
    expect(cardMarkup).toContain("50 / 50 participants");
    expect(cardMarkup).toContain("COMPLET");
    expect(panelMarkup).toContain("Concours complet");
    expect(panelMarkup).toContain("disabled");
    expect(panelMarkup).toContain("Plus aucune place disponible");
    expect(panelMarkup).not.toContain("Participer au concours");
  });

  it("renders ranked participants and their linked capture", () => {
    const markup = renderToStaticMarkup(
      <ContestLeaderboard
        items={[
          {
            rank: 1,
            score: 42,
            participant: {
              id: "user-1",
              publicSlug: "nico",
              displayName: "Nico",
              username: "nico_tg",
              profilePhotoUrl: null,
            },
            entry: { id: "entry-1", slug: "ma-fiche", name: "Ma fiche", primaryImageUrl: null },
            submittedAt: "2026-08-05T10:00:00.000Z",
            isWinner: true,
            winner: { rank: 1, label: "Champion", prize: {} },
          },
        ]}
      />,
    );

    expect(markup).toContain('href="/profil/nico"');
    expect(markup).toContain('href="/fiches/ma-fiche"');
    expect(markup).toContain("42");
    expect(markup).toContain("Gagnant");
  });
});

describe("contest administration UI", () => {
  it("keeps creation controls for administrators", () => {
    const markup = renderToStaticMarkup(
      <AdminContestManager initialContests={[adminContest]} canManage />,
    );

    expect(markup).toContain("Nouveau concours");
    expect(markup).toContain("Gérer le concours");
    expect(markup).toContain("À modérer");
  });

  it("shows moderation without leaking creation controls to moderators", () => {
    const markup = renderToStaticMarkup(
      <AdminContestManager initialContests={[adminContest]} canManage={false} />,
    );

    expect(markup).not.toContain("Nouveau concours");
    expect(markup).toContain("Modérer les participants");
  });

  it("normalizes snake-case list responses before opening the edit form", () => {
    const value = adminContestValue({
      ...adminContest,
      startsAt: undefined as never,
      endsAt: undefined as never,
      scoringMode: undefined as never,
      isFeatured: undefined as never,
      requireEntry: undefined as never,
      maxParticipants: undefined as never,
      starts_at: "2026-09-01T12:00:00.000Z",
      ends_at: "2026-09-08T12:00:00.000Z",
      scoring_mode: "COMPOSITE",
      is_featured: true,
      require_entry: false,
      max_participants: "250",
    });

    expect(value).toMatchObject({
      startsAt: "2026-09-01T12:00:00.000Z",
      endsAt: "2026-09-08T12:00:00.000Z",
      scoringMode: "COMPOSITE",
      isFeatured: true,
      requireEntry: false,
      maxParticipants: 250,
    });
  });
});
