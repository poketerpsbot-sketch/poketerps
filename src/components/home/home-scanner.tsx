"use client";

import { useState } from "react";
import { Archive, BarChart3, Dices, Flame, Gift, ScanSearch, Sparkles, Trophy } from "lucide-react";

import type { EntrySummaryDto, HomeDto, TrainerRankingDto } from "@/components/data/types";
import { ScanResultCard, type ScanResult } from "@/components/home/scan-result-card";

type ScanPhase = "idle" | "scanning" | "detected" | "result";

function entrySubtitle(entry: EntrySummaryDto) {
  return (
    [entry.category?.name ?? entry.categoryName, entry.subcategory?.name]
      .filter(Boolean)
      .join(" · ") ||
    entry.shortDescription ||
    null
  );
}

function asStats(items: Array<{ label: string; value: string } | null>) {
  return items.filter((item): item is { label: string; value: string } => Boolean(item));
}

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
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const scanning = phase === "scanning" || phase === "detected";

  function buildPossibilities(): ScanResult[] {
    const items: ScanResult[] = [];
    if (dailyDiscovery) {
      items.push({
        kind: "discovery",
        label: "Découverte du Pokédex",
        title: dailyDiscovery.name,
        subtitle: entrySubtitle(dailyDiscovery),
        href: `/fiches/${encodeURIComponent(dailyDiscovery.slug)}`,
        action: "Découvrir",
        icon: Dices,
        imageUrl: dailyDiscovery.primaryImageUrl,
        stats: asStats([
          Number(dailyDiscovery.viewCount ?? 0) > 0
            ? { label: "Vues", value: Number(dailyDiscovery.viewCount).toLocaleString("fr-CH") }
            : null,
          Number(dailyDiscovery.likeCount ?? 0) > 0
            ? { label: "J’aime", value: Number(dailyDiscovery.likeCount).toLocaleString("fr-CH") }
            : null,
        ]),
      });
    }
    const trend = trendingEntries[Math.floor(Math.random() * Math.max(1, trendingEntries.length))];
    if (trend) {
      const trendRating = Number(trend.averageRating ?? 0);
      items.push({
        kind: "trend",
        label: "Fiche tendance",
        title: trend.name,
        subtitle: entrySubtitle(trend),
        href: `/fiches/${encodeURIComponent(trend.slug)}`,
        action: "Voir la fiche",
        icon: Flame,
        imageUrl: trend.primaryImageUrl,
        stats: asStats([
          { label: "Vues", value: Number(trend.viewCount ?? 0).toLocaleString("fr-CH") },
          Number(trend.likeCount ?? 0) > 0
            ? { label: "J’aime", value: Number(trend.likeCount).toLocaleString("fr-CH") }
            : null,
          trendRating > 0
            ? {
                label: "Note",
                value: `${trendRating.toLocaleString("fr-CH", { maximumFractionDigits: 1 })} / 5`,
              }
            : null,
        ]),
      });
    }
    if (contest) {
      const participants =
        contest.participantCount ??
        (contest.maxParticipants != null && contest.remainingParticipants != null
          ? Math.max(0, contest.maxParticipants - contest.remainingParticipants)
          : null);
      items.push({
        kind: "contest",
        label: "Concours détecté",
        title: contest.title,
        subtitle: contest.summary,
        href: `/concours/${encodeURIComponent(contest.slug)}`,
        action: "Participer",
        icon: Gift,
        imageUrl: contest.coverImageUrl,
        stats: asStats([
          participants != null
            ? {
                label: "Participants",
                value: `${participants}${contest.maxParticipants ? ` / ${contest.maxParticipants}` : ""}`,
              }
            : null,
          contest.remainingParticipants != null
            ? { label: "Places", value: String(contest.remainingParticipants) }
            : null,
        ]),
      });
    }
    if (viewer?.progress) {
      items.push({
        kind: "progress",
        label: "Analyse du Dresseur",
        title: `Niveau ${viewer.level} · ${viewer.profileTitle ?? viewer.progress.title ?? "Dresseur"}`,
        subtitle: viewer.progress.isMaxLevel
          ? "Niveau maximal actif atteint."
          : `Plus que ${viewer.progress.remaining} XP avant le niveau ${(viewer.level ?? 1) + 1}.`,
        href: "/profil",
        action: "Voir ma progression",
        icon: Sparkles,
        stats: [
          {
            label: "Expérience",
            value: `${Number(viewer.progress.experiencePoints ?? viewer.experiencePoints ?? 0).toLocaleString("fr-CH")} / ${viewer.progress.nextThreshold.toLocaleString("fr-CH")} XP`,
          },
          { label: "Jauge", value: `${Math.round(viewer.progress.percent)} %` },
        ],
      });
    }
    const profile = trainer?.profile ?? trainer?.user;
    if (trainer && profile) {
      items.push({
        kind: "trainer",
        label: "Dresseur détecté",
        title: profile.telegramUsername ? `@${profile.telegramUsername}` : profile.displayName,
        subtitle: profile.displayName,
        href: `/profil/${encodeURIComponent(profile.publicSlug ?? profile.slug ?? "")}`,
        action: "Voir le profil",
        icon: Trophy,
        avatarUrl: profile.profilePhotoUrl,
        stats: [
          { label: "Niveau", value: String(profile.level ?? trainer.level ?? 1) },
          { label: "Captures", value: Number(trainer.captures ?? 0).toLocaleString("fr-CH") },
        ],
      });
    }
    items.push({
      kind: "archive",
      label: "Signal des archives",
      title: `${publishedEntryCount.toLocaleString("fr-CH")} fiches publiées`,
      subtitle: "Contributions vérifiées dans le Pokédex communautaire.",
      href: "/explorer",
      action: "Explorer",
      icon: Archive,
      stats: [{ label: "Signal", value: "Archives en ligne" }],
    });
    return items;
  }

  async function scan() {
    if (scanning) return;
    setPhase("scanning");
    setResult(null);
    await new Promise((resolve) => setTimeout(resolve, 850));
    const choices = buildPossibilities();
    setResult(choices[Math.floor(Math.random() * choices.length)] ?? null);
    setPhase("detected");
    await new Promise((resolve) => setTimeout(resolve, 220));
    setPhase("result");
  }

  return (
    <section
      className={`home-scanner device-panel${scanning ? " is-scanning" : ""}${phase === "detected" ? " is-detected" : ""}`}
    >
      <div className="home-scanner__visual" aria-hidden="true">
        <span className="scanner-orbit" />
        <span className="scanner-line" />
        <span className="pokeball" />
        {phase === "detected" && <span className="home-scanner__detected">Cible détectée</span>}
      </div>
      <div className="home-scanner__copy">
        <p className="eyebrow">Scanner communautaire</p>
        <h2>
          {phase === "detected"
            ? "Cible détectée"
            : phase === "scanning"
              ? "Analyse des archives…"
              : "Scanner le Pokédex"}
        </h2>
        {phase !== "result" && (
          <p>Lance un scan pour découvrir une fiche, un concours ou ta prochaine progression.</p>
        )}
        {phase !== "result" && (
          <button className="button" type="button" onClick={() => void scan()} disabled={scanning}>
            {phase === "detected" ? (
              <BarChart3 aria-hidden="true" />
            ) : (
              <ScanSearch aria-hidden="true" />
            )}
            {phase === "detected"
              ? "Signal verrouillé"
              : phase === "scanning"
                ? "Scan en cours…"
                : "Scanner le Pokédex"}
          </button>
        )}
        <div className="home-scanner__result" aria-live="polite">
          {result && phase === "result" && (
            <ScanResultCard result={result} onRescan={() => void scan()} />
          )}
        </div>
      </div>
    </section>
  );
}
