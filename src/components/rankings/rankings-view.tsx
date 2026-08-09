import Link from "next/link";
import { Eye, Flame, Heart, Medal, Star, Trophy } from "lucide-react";
import type { EntryRankingDto, EntrySummaryDto, TrainerRankingDto } from "@/components/data/types";
import { EntryCard } from "@/components/entries/entry-card";
import { EmptyState, ErrorState, SectionHeading, formatCount } from "@/components/ui/states";

export type RankingPeriod = "week" | "month" | "all";
export type RankingMetric = "views" | "likes" | "rating" | "recent";

const periods: Array<{ value: RankingPeriod; label: string }> = [
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "all", label: "Général" },
];

const metrics: Array<{ value: RankingMetric; label: string; icon: typeof Eye }> = [
  { value: "views", label: "Plus vues", icon: Eye },
  { value: "likes", label: "Plus aimées", icon: Heart },
  { value: "rating", label: "Mieux notées", icon: Star },
  { value: "recent", label: "Plus récentes", icon: Flame },
];

function profile(item: TrainerRankingDto) {
  return (
    item.user ??
    item.profile ?? {
      displayName: item.displayName ?? "Dresseur",
      publicSlug: item.publicSlug,
      telegramUsername: item.telegramUsername,
    }
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function trainerHref(item: TrainerRankingDto) {
  const value = profile(item).publicSlug ?? profile(item).id;
  return value ? `/profil/${encodeURIComponent(String(value))}` : "/classements";
}

function medal(index: number) {
  return ["🥇", "🥈", "🥉"][index] ?? <Medal aria-hidden="true" />;
}

function asRankedEntry(item: EntryRankingDto | EntrySummaryDto, index: number) {
  if ("entry" in item && item.entry)
    return { rank: item.rank ?? index + 1, value: item.value, entry: item.entry };
  const direct = item as EntrySummaryDto & { rank?: number; metricValue?: number | string | null };
  return { rank: direct.rank ?? index + 1, value: direct.metricValue ?? null, entry: direct };
}

function metricValue(metric: RankingMetric, item: ReturnType<typeof asRankedEntry>) {
  if (item.value !== null && item.value !== undefined) return String(item.value);
  if (metric === "views") return `${formatCount(item.entry.viewCount)} vues`;
  if (metric === "likes") return `${formatCount(item.entry.likeCount)} J’aime`;
  if (metric === "rating")
    return `★ ${Number(item.entry.averageRating || 0).toLocaleString("fr-CH", { maximumFractionDigits: 1 })}`;
  return "Nouvelle capture";
}

export function RankingsView({
  period,
  metric,
  trainers,
  entries,
  trainersError,
  entriesError,
}: {
  period: RankingPeriod;
  metric: RankingMetric;
  trainers: TrainerRankingDto[];
  entries: Array<EntryRankingDto | EntrySummaryDto>;
  trainersError?: string | null;
  entriesError?: string | null;
}) {
  const podium = trainers.slice(0, 3);
  const rest = trainers.slice(3);

  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Hall des Dresseurs</p>
          <h1 className="page-title">Classements</h1>
          <p>
            Les rangs utilisent uniquement les captures validées, publiées et toujours publiques.
          </p>
        </div>
        <Trophy className="page-header__mark" size={58} aria-hidden="true" />
      </header>

      <nav className="tabs" aria-label="Période du classement">
        {periods.map((item) => (
          <Link
            href={`/classements?period=${item.value}&metric=${metric}`}
            key={item.value}
            aria-current={period === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="rank-section screen-panel rank-section--screen">
        <SectionHeading
          eyebrow={periods.find((item) => item.value === period)?.label}
          title="Meilleurs Dresseurs"
          description="Une capture compte à sa date de publication."
        />
        {trainersError ? (
          <ErrorState
            message={trainersError}
            retryHref={`/classements?period=${period}&metric=${metric}`}
          />
        ) : trainers.length === 0 ? (
          <EmptyState
            title="Le podium attend ses Dresseurs"
            description="Aucune capture publiée ne compte encore sur cette période."
          />
        ) : (
          <>
            <div className="podium">
              {podium.map((item, index) => {
                const user = profile(item);
                return (
                  <Link
                    className={`podium-card podium-card--${["first", "second", "third"][index]}`}
                    href={trainerHref(item)}
                    key={`${item.rank}-${user.publicSlug ?? index}`}
                  >
                    <span
                      className="podium-card__medal"
                      aria-label={`Rang ${item.rank ?? index + 1}`}
                    >
                      {medal(index)}
                    </span>
                    <span className="avatar" aria-hidden="true">
                      {initials(user.displayName)}
                    </span>
                    <h3>{user.displayName}</h3>
                    <p>
                      {user.telegramUsername
                        ? `@${user.telegramUsername}`
                        : (user.profileTitle ?? "Dresseur")}
                    </p>
                    <strong>{item.captures} captures</strong>
                    {item.badge?.name && <span className="tag">{item.badge.name}</span>}
                  </Link>
                );
              })}
            </div>
            {rest.length > 0 && (
              <div className="rank-list">
                {rest.map((item, index) => {
                  const user = profile(item);
                  return (
                    <Link
                      className="rank-row"
                      href={trainerHref(item)}
                      key={`${item.rank}-${user.publicSlug ?? index}`}
                    >
                      <span className="rank-row__rank">{item.rank ?? index + 4}</span>
                      <span className="avatar" aria-hidden="true">
                        {initials(user.displayName)}
                      </span>
                      <span className="rank-row__copy">
                        <h3>{user.displayName}</h3>
                        <p>
                          {user.telegramUsername
                            ? `@${user.telegramUsername}`
                            : (user.profileTitle ?? "Dresseur")}{" "}
                          · {item.totalCaptures ?? item.captures} au total
                        </p>
                      </span>
                      <strong className="rank-row__value">{item.captures} captures</strong>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <section className="section-stack">
        <SectionHeading
          eyebrow="Tops des fiches"
          title="Captures remarquables"
          description="Pour les vues et les J’aime, la période porte sur les événements enregistrés."
        />
        <nav className="tabs" aria-label="Métrique du classement des fiches">
          {metrics.map(({ value, label, icon: Icon }) => (
            <Link
              href={`/classements?period=${period}&metric=${value}`}
              key={value}
              aria-current={metric === value ? "page" : undefined}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
        {entriesError ? (
          <ErrorState
            message={entriesError}
            retryHref={`/classements?period=${period}&metric=${metric}`}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Aucune fiche classée"
            description="Les statistiques de cette période ne contiennent pas encore de capture publique."
          />
        ) : (
          <div className="ranked-entry-grid">
            {entries.map((raw, index) => {
              const item = asRankedEntry(raw, index);
              return (
                <div className="ranked-entry" key={String(item.entry.id)}>
                  <span className="ranked-entry__rank">#{item.rank}</span>
                  <span className="ranked-entry__value">{metricValue(metric, item)}</span>
                  <EntryCard entry={item.entry} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
