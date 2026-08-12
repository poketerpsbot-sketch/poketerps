// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContestHallOfFame } from "@/components/contests/contest-hall-of-fame";
import type { ContestHallOfFameResult } from "@/components/contests/types";

function result(index: number, overrides: Partial<ContestHallOfFameResult> = {}) {
  return {
    id: `contest-${index}`,
    slug: `concours-${index}`,
    title: `Concours ${index}`,
    contestType: "COMMUNITY" as const,
    endedAt: `2026-08-${String(12 - index).padStart(2, "0")}T10:00:00.000Z`,
    resultPublishedAt: `2026-08-${String(12 - index).padStart(2, "0")}T12:00:00.000Z`,
    resultText: "Félicitations à notre gagnant !",
    resultImageUrl: null,
    resultWeight: null,
    weightUnit: null,
    winners: [
      {
        id: `winner-${index}-1`,
        rank: 1,
        label: "Champion",
        prize: {},
        awardedAt: `2026-08-${String(12 - index).padStart(2, "0")}T12:00:00.000Z`,
        participant: {
          id: `user-${index}-1`,
          publicSlug: `user-${index}`,
          displayName: `Dresseur ${index}`,
          username: `winner${index}`,
          profilePhotoUrl: null,
        },
        guess: null,
      },
    ],
    ...overrides,
  } satisfies ContestHallOfFameResult;
}

function response(items: ContestHallOfFameResult[], total: number) {
  return Promise.resolve(
    new Response(JSON.stringify({ data: items, pagination: { limit: 20, offset: 0, total } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("contest Hall of Fame", () => {
  it("shows exactly three recent winners, opens the modal, renders a podium and loads more", async () => {
    const recent = [result(0), result(1), result(2)];
    const podium = result(0, {
      title: "Devine le poids",
      contestType: "WEIGHT_GUESS",
      resultImageUrl: "https://example.supabase.co/storage/v1/object/sign/final.jpg",
      resultWeight: 12.47,
      weightUnit: "g",
      winners: [
        { ...recent[0]!.winners[0]!, guess: { numericValue: 12.46, unit: "g" } },
        {
          ...recent[0]!.winners[0]!,
          id: "winner-0-2",
          rank: 2,
          participant: {
            ...recent[0]!.winners[0]!.participant,
            id: "user-0-2",
            publicSlug: "second",
            displayName: "Deuxième",
            username: "second",
          },
          guess: { numericValue: 12.5, unit: "g" },
        },
      ],
    });
    const firstPage = [podium, ...Array.from({ length: 19 }, (_, index) => result(index + 1))];
    const finalPage = [result(20, { title: "Dernier résultat" })];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => response(recent, 21))
      .mockImplementationOnce(() => response(firstPage, 21))
      .mockImplementationOnce(() => response(finalPage, 21));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<ContestHallOfFame />);
    expect(container.querySelectorAll(".contest-hall__skeleton")).toHaveLength(3);

    await screen.findByText("@winner0");
    const compactCards = container.querySelectorAll(".contest-hall__recent-card");
    expect(compactCards).toHaveLength(3);
    expect(compactCards[0]?.textContent).toContain("Concours 0");
    expect(compactCards[1]?.textContent).toContain("Concours 1");
    expect(compactCards[2]?.textContent).toContain("Concours 2");

    fireEvent.click(screen.getByRole("button", { name: /Voir tous les gagnants/ }));
    const dialog = await screen.findByRole("dialog", { name: /Tous les gagnants/ });
    expect(dialog.textContent).toContain("Devine le poids");
    expect(dialog.textContent).toContain("🥇 Première place");
    expect(dialog.textContent).toContain("🥈 Deuxième place");
    expect(dialog.textContent).toContain("12,47 g");
    expect(dialog.textContent).toContain("12,46 g");
    expect(dialog.textContent).toContain("0,01 g");
    expect(dialog.textContent).toContain("Félicitations à notre gagnant !");
    expect(
      screen.getByRole("img", { name: "Photo du résultat du concours Devine le poids" }),
    ).toBeTruthy();

    const contestLink = screen.getAllByRole("link", { name: "Voir le concours" })[0]!;
    contestLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(contestLink);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /Voir tous les gagnants/ }));
    await screen.findByRole("dialog", { name: /Tous les gagnants/ });

    fireEvent.click(screen.getByRole("button", { name: "Charger plus" }));
    await screen.findByText("Dernier résultat");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/contests/winners?limit=20&offset=20",
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole("button", { name: "Fermer les résultats des concours" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the empty state without a Voir plus button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(() => response([], 0)),
    );
    render(<ContestHallOfFame />);

    expect(await screen.findByText("Aucun gagnant pour le moment.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Voir tous les gagnants/ })).toBeNull();
  });
});
