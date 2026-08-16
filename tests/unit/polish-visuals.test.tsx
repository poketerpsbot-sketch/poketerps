// @vitest-environment jsdom

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeScanner } from "@/components/home/home-scanner";
import { XpProgressCard } from "@/components/profiles/xp-progress-card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { telegramPhotoUpdate } from "@/lib/auth/telegram-photo";

describe("photo Telegram", () => {
  it("conserve la photo stockée si le nouveau contexte Telegram n'en fournit pas", () => {
    expect(telegramPhotoUpdate(undefined)).toEqual({});
    expect(telegramPhotoUpdate(null)).toEqual({});
    expect(telegramPhotoUpdate(" https://t.me/i/userpic/photo.svg ")).toEqual({
      profilePhotoUrl: "https://t.me/i/userpic/photo.svg",
    });
  });

  it("bascule sur les initiales si le chargement distant échoue", () => {
    render(<UserAvatar displayName="Nicolas Test" src="https://t.me/photo.svg" />);
    const image = screen.getByRole("img", { name: "Photo de profil de Nicolas Test" });
    fireEvent.error(image.querySelector("img")!);
    expect(screen.queryByRole("img", { name: "Photo de profil de Nicolas Test" })).toBeNull();
    expect(screen.getByText("NT")).toBeTruthy();
  });
});

describe("résultat du scanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("enchaîne analyse, détection et carte de résultat avec nouveau scan", async () => {
    vi.useFakeTimers();
    render(
      <HomeScanner
        dailyDiscovery={{
          id: "entry-1",
          slug: "static-sift",
          name: "Static Sift",
          category: { name: "Hash", slug: "hash" },
          primaryImageUrl: "/badges/v2/level-1.svg",
          viewCount: 2,
        }}
        trendingEntries={[]}
        contest={null}
        publishedEntryCount={18}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scanner le Pokédex" }));
    expect(screen.getByText("Analyse des archives…")).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(850));
    expect(screen.getAllByText("Cible détectée").length).toBeGreaterThan(0);
    await act(async () => vi.advanceTimersByTimeAsync(220));
    expect(screen.getByText("Scan terminé")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scanner à nouveau" })).toBeTruthy();
  });

  it("varie les résultats et ne répète pas les quatre derniers scans", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(
      <HomeScanner
        dailyDiscovery={{
          id: "entry-1",
          slug: "static-sift",
          name: "Static Sift",
          category: { name: "Hash", slug: "hash" },
        }}
        trendingEntries={[]}
        contest={null}
        publishedEntryCount={18}
      />,
    );

    const labels = new Set<string>();
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(
        screen.getByRole("button", {
          name: index === 0 ? "Scanner le Pokédex" : "Scanner à nouveau",
        }),
      );
      await act(async () => vi.advanceTimersByTimeAsync(1_070));
      const label = document.querySelector(".scan-result-card__signal strong")?.textContent;
      expect(label).toBeTruthy();
      labels.add(label!);
    }

    expect(labels.size).toBe(5);
    expect(labels).toContain("Découverte du Pokédex");
    expect(labels).toContain("Mission communautaire");
  });
});

describe("jauge XP maximale", () => {
  it("affiche un remplissage complet et le bon titre pour un rôle renforcé", () => {
    const { container } = render(
      <XpProgressCard
        experience={{
          progress: {
            level: 15,
            title: "Légende PokéTerps",
            experiencePoints: 10_250,
            realExperiencePoints: 320,
            currentThreshold: 8_350,
            nextThreshold: 10_250,
            remaining: 0,
            percent: 100,
            isMaxLevel: true,
            isRoleBoosted: true,
            roleBoostRole: "OWNER",
          },
        }}
      />,
    );

    expect(screen.getAllByText("Niveau 15 · Légende PokéTerps").length).toBeGreaterThan(0);
    expect(screen.getByText("Niveau maximal actif · jauge synchronisée à 100 %")).toBeTruthy();
    expect(container.querySelector(".xp-progress.is-complete")).toBeTruthy();
    expect(container.querySelector<HTMLElement>(".xp-progress__fill")?.style.width).toBe("100%");
  });
});

describe("collection de badges V2", () => {
  it("associe les 19 slugs à 19 assets présents et différents", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260816193112_badge_visual_collection_v2.sql"),
      "utf8",
    );
    const urls = [...migration.matchAll(/then '(\/badges\/v2\/[^']+)'/g)].map((match) => match[1]);
    expect(urls).toHaveLength(19);
    expect(new Set(urls)).toHaveLength(19);
    const hashes = urls.map((url) =>
      createHash("sha256")
        .update(fs.readFileSync(path.join(process.cwd(), "public", url.replace(/^\//, ""))))
        .digest("hex"),
    );
    expect(new Set(hashes)).toHaveLength(19);
  });
});
