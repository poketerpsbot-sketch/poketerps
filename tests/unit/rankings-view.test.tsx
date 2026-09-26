import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TrainerRankingDto } from "@/components/data/types";
import { RankingsView } from "@/components/rankings/rankings-view";

const trainer: TrainerRankingDto = {
  rank: 1,
  captures: 4,
  periodCaptures: 4,
  totalCaptures: 12,
  likesReceived: 8,
  viewsReceived: 120,
  level: 7,
  experiencePoints: 950,
  publicSlug: "alice",
  displayName: "Alice",
  telegramUsername: "alice_tg",
  profilePhotoUrl: "https://cdn.example.test/alice.jpg",
  badge: {
    name: "Pionnière",
    icon: "◆",
    imageUrl: "/badges/level-5.png",
    rarity: "UNCOMMON",
  },
};

function renderRankings(overrides: Partial<Parameters<typeof RankingsView>[0]> = {}) {
  return renderToStaticMarkup(
    <RankingsView
      period="week"
      metric="views"
      trainers={[trainer]}
      currentTrainer={trainer}
      entries={[]}
      trainerPage={1}
      trainerTotal={25}
      trainerTotalPages={2}
      entryPage={1}
      entryTotal={0}
      entryTotalPages={1}
      {...overrides}
    />,
  );
}

describe("competitive rankings view", () => {
  it("shows the authenticated rank, real engagement metrics and an accessible next page", () => {
    const html = renderRankings();

    expect(html).toContain("Ta position");
    expect(html).toContain("950 XP");
    expect(html).toContain("J’aime");
    expect(html).toContain("120");
    expect(html).toContain("Pionnière");
    expect(html).toContain('src="https://cdn.example.test/alice.jpg"');
    expect(html).toContain("@alice_tg");
    expect(html).toContain("Alice");
    expect(html).toContain("badge-emblem");
    expect(html).not.toContain("/badges/level-5.png");
    expect(html).toContain("trainersPage=2");
    expect(html).toContain('aria-label="Page suivante"');
  });

  it("uses a compact leaderboard instead of recreating a podium on later pages", () => {
    const second = { ...trainer, rank: 21, publicSlug: "page-two" };
    const html = renderRankings({
      trainers: [second],
      currentTrainer: null,
      trainerPage: 2,
      trainerTotalPages: 3,
    });

    expect(html).not.toContain("competition-podium");
    expect(html).toContain("competition-rank-row");
    expect(html).toMatch(
      /aria-label="Page précédente" href="\/classements\?period=week&amp;metric=views"/,
    );
    expect(html).toContain("trainersPage=3");
  });

  it("falls back to initials and keeps long identities inside the row", () => {
    const html = renderRankings({
      trainers: [
        {
          ...trainer,
          rank: 2,
          profilePhotoUrl: null,
          telegramUsername: "@un_pseudo_telegram_tres_long",
          displayName: "Utilisateur communautaire très long",
        },
      ],
      currentTrainer: null,
      trainerTotal: 1,
      trainerTotalPages: 1,
    });

    expect(html).not.toContain('src="https://cdn.example.test/alice.jpg"');
    expect(html).toContain("@un_pseudo_telegram_tres_long");
    expect(html).toContain("Utilisateur communautaire très long");
    expect(html).toContain(">UC</span>");
  });
});
