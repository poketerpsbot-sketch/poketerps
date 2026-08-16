"use client";

import { useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  Dices,
  FilePlus2,
  Flame,
  Gift,
  Medal,
  Search,
  ScanSearch,
  Sparkles,
  Telescope,
  Trophy,
  UsersRound,
} from "lucide-react";

import type {
  EntrySummaryDto,
  HomeDto,
  PartnerDto,
  TrainerRankingDto,
} from "@/components/data/types";
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
  latestEntries = [],
  contest,
  viewer,
  trainer,
  trainers = [],
  partner,
  publishedEntryCount,
}: {
  dailyDiscovery?: EntrySummaryDto | null;
  trendingEntries: EntrySummaryDto[];
  latestEntries?: EntrySummaryDto[];
  contest?: NonNullable<HomeDto["activeContest"]> | null;
  viewer?: HomeDto["viewer"];
  trainer?: TrainerRankingDto;
  trainers?: TrainerRankingDto[];
  partner?: PartnerDto | null;
  publishedEntryCount: number;
}) {
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const recentResultIdsRef = useRef<string[]>([]);
  const scanInProgressRef = useRef(false);
  const scanning = phase === "scanning" || phase === "detected";

  function buildPossibilities(): ScanResult[] {
    const items: ScanResult[] = [];
    const usedEntrySlugs = new Set<string>();

    function addEntry(entry: EntrySummaryDto, kind: "discovery" | "trend" | "recent") {
      if (usedEntrySlugs.has(entry.slug)) return;
      usedEntrySlugs.add(entry.slug);
      const rating = Number(entry.averageRating ?? 0);
      items.push({
        id: `entry:${entry.slug}`,
        kind,
        label:
          kind === "discovery"
            ? "Découverte du Pokédex"
            : kind === "trend"
              ? "Fiche tendance"
              : "Archive fraîchement publiée",
        title: entry.name,
        subtitle: entrySubtitle(entry),
        href: `/fiches/${encodeURIComponent(entry.slug)}`,
        action: kind === "discovery" ? "Découvrir" : "Voir la fiche",
        icon: kind === "discovery" ? Dices : kind === "trend" ? Flame : Telescope,
        imageUrl: entry.primaryImageUrl,
        stats: asStats([
          { label: "Vues", value: Number(entry.viewCount ?? 0).toLocaleString("fr-CH") },
          Number(entry.likeCount ?? 0) > 0
            ? { label: "J’aime", value: Number(entry.likeCount).toLocaleString("fr-CH") }
            : null,
          rating > 0
            ? {
                label: "Note",
                value: `${rating.toLocaleString("fr-CH", { maximumFractionDigits: 1 })} / 5`,
              }
            : null,
        ]),
      });
    }

    if (dailyDiscovery) {
      addEntry(dailyDiscovery, "discovery");
    }
    trendingEntries.slice(0, 4).forEach((entry) => addEntry(entry, "trend"));
    latestEntries.slice(0, 5).forEach((entry) => addEntry(entry, "recent"));
    if (contest) {
      const participants =
        contest.participantCount ??
        (contest.maxParticipants != null && contest.remainingParticipants != null
          ? Math.max(0, contest.maxParticipants - contest.remainingParticipants)
          : null);
      items.push({
        id: `contest:${String(contest.id)}`,
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
    } else {
      items.push({
        id: "contest-hub",
        kind: "contest-hub",
        label: "Radar des concours",
        title: "Le prochain défi t’attend",
        subtitle: "Explore les concours, leurs récompenses et les prochaines inscriptions.",
        href: "/concours",
        action: "Voir les concours",
        icon: Gift,
        stats: [{ label: "Mode", value: "Compétition" }],
      });
    }
    if (viewer?.progress) {
      items.push({
        id: "viewer-progress",
        kind: "progress",
        label: "Analyse du Dresseur",
        title: `Niveau ${viewer.level} · ${viewer.progress.title ?? viewer.profileTitle ?? "Dresseur"}`,
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
    const trainerCandidates = [trainer, ...trainers].filter(
      (candidate): candidate is TrainerRankingDto => Boolean(candidate),
    );
    const usedTrainerSlugs = new Set<string>();
    for (const candidate of trainerCandidates.slice(0, 4)) {
      const profile = candidate.profile ?? candidate.user;
      const slug = profile?.publicSlug ?? profile?.slug;
      if (!profile || !slug || usedTrainerSlugs.has(slug)) continue;
      usedTrainerSlugs.add(slug);
      items.push({
        id: `trainer:${slug}`,
        kind: "trainer",
        label: "Dresseur détecté",
        title: profile.telegramUsername ? `@${profile.telegramUsername}` : profile.displayName,
        subtitle: profile.displayName,
        href: `/profil/${encodeURIComponent(slug)}`,
        action: "Voir le profil",
        icon: Trophy,
        avatarUrl: profile.profilePhotoUrl,
        stats: [
          { label: "Niveau", value: String(profile.level ?? candidate.level ?? 1) },
          { label: "Captures", value: Number(candidate.captures ?? 0).toLocaleString("fr-CH") },
        ],
      });
    }
    if (partner) {
      items.push({
        id: `partner:${partner.slug}`,
        kind: "partner",
        label: "Partenaire sous le radar",
        title: partner.name,
        subtitle: partner.description,
        href: `/partenaires/${encodeURIComponent(partner.slug)}`,
        action: "Découvrir",
        icon: UsersRound,
        imageUrl: partner.logoUrl ?? partner.coverUrl,
        stats: [{ label: "Signal", value: "Partenaire vérifié" }],
      });
    }
    items.push({
      id: "archive-overview",
      kind: "archive",
      label: "Signal des archives",
      title: `${publishedEntryCount.toLocaleString("fr-CH")} fiches publiées`,
      subtitle: "Contributions vérifiées dans le Pokédex communautaire.",
      href: "/explorer",
      action: "Explorer",
      icon: Archive,
      stats: [{ label: "Signal", value: "Archives en ligne" }],
    });
    items.push(
      {
        id: "community-mission",
        kind: "mission",
        label: "Mission communautaire",
        title: "Documente une nouvelle découverte",
        subtitle: "Ajoute une fiche complète : l’équipe la vérifiera avant sa publication.",
        href: "/capturer",
        action: "Proposer une fiche",
        icon: FilePlus2,
        stats: [{ label: "Récompense", value: "XP après validation" }],
      },
      {
        id: "ranking-challenge",
        kind: "ranking",
        label: "Défi des Dresseurs",
        title: "Grimpe dans les classements",
        subtitle: "Compare tes captures sur la semaine, le mois et le classement général.",
        href: "/classements",
        action: "Voir les classements",
        icon: Medal,
        stats: [
          { label: "Périodes", value: "3" },
          { label: "Objectif", value: "Top Dresseur" },
        ],
      },
      {
        id: "advanced-search",
        kind: "search",
        label: "Recherche avancée",
        title: "Trouve ta prochaine fiche",
        subtitle:
          "Combine catégories, notes, popularité et caractéristiques pour explorer autrement.",
        href: "/explorer",
        action: "Lancer une recherche",
        icon: Search,
        stats: [{ label: "Mode", value: "Filtres avancés" }],
      },
    );
    return items;
  }

  async function scan() {
    if (scanInProgressRef.current) return;
    scanInProgressRef.current = true;
    setPhase("scanning");
    setResult(null);
    await new Promise((resolve) => setTimeout(resolve, 850));
    const choices = buildPossibilities();
    const recentResultIds = recentResultIdsRef.current;
    const unseenChoices = choices.filter((choice) => !recentResultIds.includes(choice.id));
    const eligibleChoices = unseenChoices.length
      ? unseenChoices
      : choices.filter((choice) => choice.id !== recentResultIds.at(-1));
    const pool = eligibleChoices.length ? eligibleChoices : choices;
    const selected = pool[Math.floor(Math.random() * pool.length)] ?? null;
    setResult(selected);
    if (selected) {
      recentResultIdsRef.current = [
        ...recentResultIds.filter((id) => id !== selected.id),
        selected.id,
      ].slice(-4);
    }
    setPhase("detected");
    await new Promise((resolve) => setTimeout(resolve, 220));
    setPhase("result");
    scanInProgressRef.current = false;
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
