// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContestParticipationPanel } from "@/components/contests/contest-participation";
import type { ContestDetailData, ContestParticipation } from "@/components/contests/types";

const contest: ContestDetailData = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "devine-le-poids",
  title: "Devine le poids",
  summary: "Trouve le poids le plus proche.",
  imageUrl: null,
  status: "ACTIVE",
  phase: "ACTIVE",
  isFeatured: false,
  startsAt: "2026-08-01T10:00:00.000Z",
  endsAt: "2026-08-31T20:00:00.000Z",
  scoringMode: "MANUAL",
  reward: { title: "Le Ronflex" },
  participantCount: 0,
  maxParticipants: null,
  remainingParticipants: null,
  isFull: false,
  registrationsOpen: true,
  contestType: "WEIGHT_GUESS",
  participationOpen: true,
  weightUnit: "g",
  description: "",
  rules: "",
  criteria: {},
  rewardBadge: null,
  requireEntry: false,
  instructions: "",
  participationSteps: [],
  externalUrl: null,
  telegramUrl: null,
  instagramUrl: null,
  terms: null,
  additionalInformation: null,
  registrationStartsAt: null,
  registrationEndsAt: null,
  winners: [],
  viewerParticipation: null,
};

const participation: ContestParticipation = {
  id: "22222222-2222-4222-8222-222222222222",
  contestId: contest.id,
  entryId: null,
  status: "PENDING_REVIEW",
  statement: null,
  submittedAt: "2026-08-10T10:00:00.000Z",
  updatedAt: "2026-08-10T10:00:00.000Z",
  withdrawnAt: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("contest participation first-click flow", () => {
  it("shows both estimations even when the refresh after joining fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/participation") && init?.method === "POST") {
        return new Response(JSON.stringify({ data: participation }), { status: 201 });
      }
      if (url.endsWith("/api/me")) {
        return new Response(JSON.stringify({ data: { publishedEntries: [] } }), { status: 200 });
      }
      if (url.includes("/events")) {
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      }
      if (url.includes("/api/contests/")) {
        throw new Error("temporary contest refresh failure");
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200 });
    });

    render(<ContestParticipationPanel initialContest={contest} initiallyAuthenticated />);
    fireEvent.submit(
      screen.getByRole("button", { name: "Participer au concours" }).closest("form")!,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer ma participation" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Estimation n°1")).toBeTruthy();
      expect(screen.getByLabelText("Estimation n°2")).toBeTruthy();
    });
    expect(screen.getAllByText("✅ Parfait, tu participes maintenant à ce concours !").length).toBe(
      2,
    );
  });
});
