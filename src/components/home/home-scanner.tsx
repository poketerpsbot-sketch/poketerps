"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanSearch } from "lucide-react";

import type { EntrySummaryDto, HomeDto, TrainerRankingDto } from "@/components/data/types";

type ScanResult = { eyebrow: string; title: string; detail: string; href: string; action: string };

export function HomeScanner({
  dailyDiscovery,
  trendingEntries,
  contest,
  viewer,
  trainer,
  publishedEntryCount,
}: {
  dailyDiscovery?: EntrySummaryDto | null;
  trendingEntries: EntrySummaryDto[];
  contest?: NonNullable<HomeDto["activeContest"]> | null;
  viewer?: HomeDto["viewer"];
  trainer?: TrainerRankingDto;
  publishedEntryCount: number;
}) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function scan() {
    if (scanning) return;
    setScanning(true);
    setResult(null);
    await new Promise((resolve) => setTimeout(resolve, 850));
    const possibilities: ScanResult[] = [];
    if (dailyDiscovery) {
      possibilities.push({
        eyebrow: "🎲 Découverte du Pokédex",
        title: dailyDiscovery.name,
        detail: dailyDiscovery.shortDescription ?? "Une fiche à découvrir dans les archives.",
        href: `/fiches/${encodeURIComponent(dailyDiscovery.slug)}`,
        action: "Ouvrir la fiche",
      });
    }
    const trend = trendingEntries[Math.floor(Math.random() * Math.max(1, trendingEntries.length))];
    if (trend) {
      possibilities.push({
        eyebrow: "🔥 Fiche tendance",
        title: trend.name,
        detail: `${Number(trend.viewCount ?? 0).toLocaleString("fr-CH")} vues dans le Pokédex.`,
        href: `/fiches/${encodeURIComponent(trend.slug)}`,
        action: "Voir",
      });
    }
    if (contest) {
      possibilities.push({
        eyebrow: "🎁 Concours ouvert",
        title: contest.title,
        detail:
          contest.remainingParticipants == null
            ? (contest.summary ?? "Les inscriptions sont ouvertes.")
            : `${contest.remainingParticipants} place${contest.remainingParticipants > 1 ? "s" : ""} restante${contest.remainingParticipants > 1 ? "s" : ""}.`,
        href: `/concours/${encodeURIComponent(contest.slug)}`,
        action: "Participer",
      });
    }
    if (viewer?.progress) {
      possibilities.push({
        eyebrow: "✨ Progression",
        title: `Niveau ${viewer.level} · ${viewer.profileTitle ?? "Dresseur"}`,
        detail: `Tu es à ${viewer.progress.remaining} XP du niveau suivant.`,
        href: "/profil",
        action: "Voir mon profil",
      });
    }
    const profile = trainer?.profile ?? trainer?.user;
    if (trainer && profile) {
      possibilities.push({
        eyebrow: "🏆 Dresseur tendance",
        title: profile.displayName,
        detail: `${trainer.captures} capture${trainer.captures > 1 ? "s" : ""} cette semaine.`,
        href: `/profil/${encodeURIComponent(profile.publicSlug ?? profile.slug ?? "")}`,
        action: "Voir le profil",
      });
    }
    possibilities.push({
      eyebrow: "📡 Statistique Pokédex",
      title: `${publishedEntryCount.toLocaleString("fr-CH")} fiches publiées`,
      detail: "Les archives grandissent grâce aux contributions vérifiées.",
      href: "/explorer",
      action: "Explorer",
    });
    setResult(possibilities[Math.floor(Math.random() * possibilities.length)] ?? null);
    setScanning(false);
  }

  return (
    <section className={`home-scanner device-panel${scanning ? " is-scanning" : ""}`}>
      <div className="home-scanner__visual" aria-hidden="true">
        <span className="scanner-orbit" />
        <span className="scanner-line" />
        <span className="pokeball" />
      </div>
      <div className="home-scanner__copy">
        <p className="eyebrow">Scanner communautaire</p>
        <h2>{scanning ? "Analyse des archives…" : "Scanner le Pokédex"}</h2>
        <p>Lance un scan pour découvrir une fiche, un concours ou ta prochaine progression.</p>
        <button className="button" type="button" onClick={() => void scan()} disabled={scanning}>
          <ScanSearch aria-hidden="true" /> {scanning ? "Scan en cours…" : "Scanner le Pokédex"}
        </button>
        <div className="home-scanner__result" aria-live="polite">
          {result && !scanning && (
            <>
              <p className="eyebrow">Scan terminé · {result.eyebrow}</p>
              <h3>{result.title}</h3>
              <p>{result.detail}</p>
              <Link className="button button--secondary" href={result.href}>
                {result.action}
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
