import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeScanner } from "@/components/home/home-scanner";
import {
  BASE_LEVELS,
  effectiveExperienceProgress,
  experienceProgress,
  experienceThresholdForLevel,
  levelFromExperience,
} from "@/lib/xp";

describe("progression XP", () => {
  it("respecte chaque seuil configuré, y compris après le niveau 15", () => {
    for (const definition of BASE_LEVELS) {
      expect(levelFromExperience(definition.threshold)).toBe(definition.level);
      if (definition.threshold > 0) {
        expect(levelFromExperience(definition.threshold - 1)).toBe(definition.level - 1);
      }
    }
    expect(experienceThresholdForLevel(16)).toBe(12_550);
    expect(levelFromExperience(12_549)).toBe(15);
    expect(levelFromExperience(12_550)).toBe(16);
  });

  it("calcule une progression bornée et le reste exact", () => {
    expect(experienceProgress(700)).toMatchObject({ level: 5, percent: 0, remaining: 300 });
    expect(experienceProgress(850)).toMatchObject({ level: 5, percent: 50, remaining: 150 });
    expect(experienceProgress(-20)).toMatchObject({ level: 1, experiencePoints: 0, percent: 0 });
  });

  it.each(["OWNER", "ADMIN"] as const)(
    "affiche le plus haut niveau actif à %s sans modifier son XP réel",
    (role) => {
      const levels = [...BASE_LEVELS, { level: 17, threshold: 15_000, title: "Maître système" }];
      const progress = effectiveExperienceProgress(320, role, levels);
      expect(progress).toMatchObject({
        level: 17,
        title: "Maître système",
        experiencePoints: 15_000,
        realExperiencePoints: 320,
        percent: 100,
        isRoleBoosted: true,
      });
      expect(experienceProgress(320).experiencePoints).toBe(320);
    },
  );

  it("conserve strictement la progression normale des membres et modérateurs", () => {
    expect(effectiveExperienceProgress(320, "MEMBER", BASE_LEVELS)).toMatchObject({
      level: 3,
      experiencePoints: 320,
      realExperiencePoints: 320,
      isRoleBoosted: false,
    });
    expect(effectiveExperienceProgress(320, "MODERATOR", BASE_LEVELS)).toMatchObject({
      level: 3,
      experiencePoints: 320,
      isRoleBoosted: false,
    });
  });
});

describe("migration XP, badges et arômes", () => {
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260816090000_admin_activity_xp_badges_aromas_home.sql",
    ),
    "utf8",
  );

  it("contient les 15 familles, 95 arômes et une seule note principale", () => {
    const aromaSeed = migration.split("with aroma_seed")[1]?.split("insert into public.aromas")[0];
    expect(aromaSeed).toBeTruthy();
    expect(aromaSeed?.match(/\('[^']+','[^']+','[^']+'/g)).toHaveLength(95);
    expect(migration).toContain("entry_aromas_one_primary_idx");
    expect(migration).toContain(
      "create type public.aroma_importance as enum ('PRIMARY','SECONDARY')",
    );
    expect(migration).toContain("('autre','autre','Autre'");
  });

  it("protège les gains automatiques par des clés d'idempotence", () => {
    expect(migration).toContain("on conflict(idempotency_key) do nothing");
    expect(migration).toContain("'FIRST_ENTRY_BONUS:'||e.original_contributor_id");
    expect(migration).toContain("'CONTEST_WIN:'||w.contest_id||':'||p.user_id");
    expect(migration).toContain("badges_xp_reward_nonnegative");
  });
});

describe("scanner Pokédex", () => {
  it("reste compact et propose une vraie action de scan", () => {
    const html = renderToStaticMarkup(
      <HomeScanner
        dailyDiscovery={{
          id: "entry-1",
          slug: "blue-zushi",
          name: "Blue Zushi",
          shortDescription: "Découverte du jour",
        }}
        trendingEntries={[]}
        contest={null}
        publishedEntryCount={18}
      />,
    );
    expect(html).toContain("Scanner le Pokédex");
    expect(html).toContain("home-scanner__result");
    expect(html).not.toContain("18 grosses cartes");
  });
});
