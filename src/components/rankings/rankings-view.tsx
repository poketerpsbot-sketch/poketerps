import Link from "next/link";
import { Award, Eye, Flame, Heart, Medal, Star, Trophy, Zap } from "lucide-react";

import type { EntryRankingDto, EntrySummaryDto, TrainerRankingDto } from "@/components/data/types";
import { EntryCard } from "@/components/entries/entry-card";
import { EmptyState, ErrorState, SectionHeading, formatCount } from "@/components/ui/states";
import { UserAvatar } from "@/components/ui/user-avatar";

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
      profilePhotoUrl: item.profilePhotoUrl,
      profileTitle: item.profileTitle,
      level: item.level,
      experiencePoints: item.experiencePoints,
    }
  );
}

function RankingAvatar({ item }: { item: TrainerRankingDto }) {
  const user = profile(item);
  return (
    <UserAvatar
      className="ranking-avatar"
      displayName={user.displayName}
      src={user.profilePhotoUrl ?? item.profilePhotoUrl}
    />
  );
}

function RankingBadge({ item, compact = false }: { item: TrainerRankingDto; compact?: boolean }) {
  if (!item.badge?.name) return null;
  return (
    <span
      className={
        "ranking-badge ranking-badge--" +
        String(item.badge.rarity ?? "common").toLocaleLowerCase("fr-FR") +
        (compact ? " ranking-badge--compact" : "")
      }
      title={item.badge.name}
    >
      {item.badge.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- asset local ou URL administrable.
        <img src={item.badge.imageUrl} alt="" />
      ) : (
        <span aria-hidden="true">{item.badge.icon ?? "◆"}</span>
      )}
      <span>{item.badge.name}</span>
    </span>
  );
}

function trainerHref(item: TrainerRankingDto) {
  const value = profile(item).publicSlug ?? profile(item).id;
  return value ? "/profil/" + encodeURIComponent(String(value)) : "/classements";
}

function medal(index: number) {
  return ["🥇", "🥈", "🥉"][index] ?? <Medal aria-hidden="true" />;
}

function captures(item: TrainerRankingDto) {
  return Number(item.captures ?? item.periodCaptures ?? 0);
}

function totalCaptures(item: TrainerRankingDto) {
  return Number(item.totalCaptures ?? item.captures ?? 0);
}

function likes(item: TrainerRankingDto) {
  return Number(item.likesReceived ?? 0);
}

function views(item: TrainerRankingDto) {
  return Number(item.viewsReceived ?? 0);
}

function level(item: TrainerRankingDto) {
  return Number(profile(item).level ?? item.level ?? 1);
}

function experience(item: TrainerRankingDto) {
  return Number(profile(item).experiencePoints ?? item.experiencePoints ?? 0);
}

function asRankedEntry(item: EntryRankingDto | EntrySummaryDto, index: number) {
  if ("entry" in item && item.entry) {
    return { rank: item.rank ?? index + 1, value: item.value, entry: item.entry };
  }
  const direct = item as EntrySummaryDto & { rank?: number; metricValue?: number | string | null };
  return { rank: direct.rank ?? index + 1, value: direct.metricValue ?? null, entry: direct };
}

function metricValue(metric: RankingMetric, item: ReturnType<typeof asRankedEntry>) {
  if (item.value !== null && item.value !== undefined) {
    if (metric === "views") return formatCount(Number(item.value)) + " vues";
    if (metric === "likes") return formatCount(Number(item.value)) + " J’aime";
    if (metric === "rating") {
      return (
        "★ " +
        Number(item.value).toLocaleString("fr-CH", {
          maximumFractionDigits: 1,
        })
      );
    }
  }
  if (metric === "views") return formatCount(item.entry.viewCount) + " vues";
  if (metric === "likes") return formatCount(item.entry.likeCount) + " J’aime";
  if (metric === "rating") {
    return (
      "★ " +
      Number(item.entry.averageRating || 0).toLocaleString("fr-CH", {
        maximumFractionDigits: 1,
      })
    );
  }
  return "Nouvelle capture";
}

function rankingsHref({
  period,
  metric,
  trainerPage = 1,
  entryPage = 1,
}: {
  period: RankingPeriod;
  metric: RankingMetric;
  trainerPage?: number;
  entryPage?: number;
}) {
  const query = new URLSearchParams({ period, metric });
  if (trainerPage > 1) query.set("trainersPage", String(trainerPage));
  if (entryPage > 1) query.set("entriesPage", String(entryPage));
  return "/classements?" + query.toString();
}

function RankingPagination({
  label,
  currentPage,
  totalPages,
  previousHref,
  nextHref,
}: {
  label: string;
  currentPage: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination ranking-pagination" aria-label={label}>
      {currentPage > 1 && (
        <Link href={previousHref} aria-label="Page précédente">
          ←
        </Link>
      )}
      <span aria-current="page">
        {currentPage} / {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link href={nextHref} aria-label="Page suivante">
          →
        </Link>
      )}
    </nav>
  );
}

function TrainerMetrics({ item, compact = false }: { item: TrainerRankingDto; compact?: boolean }) {
  return (
    <span className={"trainer-metrics" + (compact ? " trainer-metrics--compact" : "")}>
      <span title="Fiches publiées">
        <Award aria-hidden="true" /> <strong>{formatCount(captures(item))}</strong>
        <small>fiches</small>
      </span>
      <span title="J’aime reçus">
        <Heart aria-hidden="true" /> <strong>{formatCount(likes(item))}</strong>
        <small>J’aime</small>
      </span>
      <span title="Vues reçues">
        <Eye aria-hidden="true" /> <strong>{formatCount(views(item))}</strong>
        <small>vues</small>
      </span>
    </span>
  );
}

function PersonalRankCard({ item, period }: { item: TrainerRankingDto; period: RankingPeriod }) {
  const user = profile(item);
  const periodLabel = periods.find((entry) => entry.value === period)?.label;
  return (
    <aside className="personal-rank-card" aria-labelledby="personal-rank-title">
      <span className="personal-rank-card__rank">#{item.rank}</span>
      <RankingAvatar item={item} />
      <div className="personal-rank-card__copy">
        <p className="eyebrow">Ta position · {periodLabel}</p>
        <h3 id="personal-rank-title">{user.displayName}</h3>
        <p>
          Niveau {level(item)} · {experience(item).toLocaleString("fr-CH")} XP ·{" "}
          {totalCaptures(item)} fiche{totalCaptures(item) > 1 ? "s" : ""} au total
        </p>
      </div>
      <TrainerMetrics item={item} compact />
    </aside>
  );
}

export function RankingsView({
  period,
  metric,
  trainers,
  currentTrainer,
  entries,
  trainerPage,
  trainerTotal,
  trainerTotalPages,
  entryPage,
  entryTotal,
  entryTotalPages,
  trainersError,
  entriesError,
}: {
  period: RankingPeriod;
  metric: RankingMetric;
  trainers: TrainerRankingDto[];
  currentTrainer?: TrainerRankingDto | null;
  entries: Array<EntryRankingDto | EntrySummaryDto>;
  trainerPage: number;
  trainerTotal: number;
  trainerTotalPages: number;
  entryPage: number;
  entryTotal: number;
  entryTotalPages: number;
  trainersError?: string | null;
  entriesError?: string | null;
}) {
  const podium = trainerPage === 1 ? trainers.slice(0, 3) : [];
  const rest = trainerPage === 1 ? trainers.slice(3) : trainers;
  const periodLabel = periods.find((item) => item.value === period)?.label ?? "Période";
  const trainerPlural = trainerTotal > 1 ? "s" : "";
  const entryPlural = entryTotal > 1 ? "s" : "";

  return (
    <div className="page-shell page-stack rankings-page">
      <header className="page-header rankings-header">
        <div className="page-header__copy">
          <p className="eyebrow">Hall des Dresseurs</p>
          <h1 className="page-title">Classements</h1>
          <p>
            Une compétition fondée sur les vraies fiches publiées. Les J’aime et les vues
            départagent les contributions à égalité.
          </p>
        </div>
        <Trophy className="page-header__mark" size={58} aria-hidden="true" />
      </header>

      <nav className="tabs ranking-tabs" aria-label="Période du classement">
        {periods.map((item) => (
          <Link
            href={rankingsHref({ period: item.value, metric })}
            key={item.value}
            aria-current={period === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="rank-section screen-panel rank-section--screen">
        <SectionHeading
          eyebrow={periodLabel}
          title="Compétition des Dresseurs"
          description={
            trainerTotal.toLocaleString("fr-CH") +
            " participant" +
            trainerPlural +
            " classé" +
            trainerPlural +
            ". Niveau et XP sont affichés ; les fiches publiées déterminent d’abord le rang."
          }
        />

        {currentTrainer && <PersonalRankCard item={currentTrainer} period={period} />}

        {trainersError ? (
          <ErrorState
            message={trainersError}
            retryHref={rankingsHref({ period, metric, trainerPage, entryPage })}
          />
        ) : trainers.length === 0 ? (
          <EmptyState
            title="Le podium attend ses Dresseurs"
            description="Aucune fiche publique réelle ne compte encore sur cette période."
          />
        ) : (
          <>
            {podium.length > 0 && (
              <div className="podium competition-podium">
                {podium.map((item, index) => {
                  const user = profile(item);
                  return (
                    <Link
                      className={"podium-card podium-card--" + ["first", "second", "third"][index]}
                      href={trainerHref(item)}
                      key={String(item.rank) + "-" + String(user.publicSlug ?? index)}
                    >
                      <span
                        className="podium-card__medal"
                        aria-label={"Rang " + String(item.rank ?? index + 1)}
                      >
                        {medal(index)}
                      </span>
                      <RankingAvatar item={item} />
                      <h3>{user.displayName}</h3>
                      <p className="podium-card__identity">
                        {user.telegramUsername
                          ? "@" + user.telegramUsername
                          : (user.profileTitle ?? "Dresseur")}
                      </p>
                      <span className="podium-card__progress">
                        <Zap aria-hidden="true" /> Niv. {level(item)} ·{" "}
                        {experience(item).toLocaleString("fr-CH")} XP
                      </span>
                      <TrainerMetrics item={item} compact />
                      <RankingBadge item={item} />
                    </Link>
                  );
                })}
              </div>
            )}

            {rest.length > 0 && (
              <div className="rank-list competition-rank-list">
                {rest.map((item, index) => {
                  const user = profile(item);
                  return (
                    <Link
                      className="rank-row competition-rank-row"
                      href={trainerHref(item)}
                      key={String(item.rank) + "-" + String(user.publicSlug ?? index)}
                    >
                      <span className="rank-row__rank">{item.rank}</span>
                      <RankingAvatar item={item} />
                      <span className="rank-row__copy">
                        <span className="competition-rank-row__heading">
                          <h3>{user.displayName}</h3>
                          {item.badge?.name && <RankingBadge item={item} compact />}
                        </span>
                        <p>
                          {user.telegramUsername
                            ? "@" + user.telegramUsername
                            : (user.profileTitle ?? "Dresseur")}{" "}
                          · Niv. {level(item)} · {experience(item).toLocaleString("fr-CH")} XP ·{" "}
                          {totalCaptures(item)} au total
                        </p>
                      </span>
                      <TrainerMetrics item={item} />
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        <RankingPagination
          label="Pages du classement des Dresseurs"
          currentPage={trainerPage}
          totalPages={trainerTotalPages}
          previousHref={rankingsHref({
            period,
            metric,
            trainerPage: trainerPage - 1,
            entryPage,
          })}
          nextHref={rankingsHref({
            period,
            metric,
            trainerPage: trainerPage + 1,
            entryPage,
          })}
        />
      </section>

      <section className="section-stack">
        <SectionHeading
          eyebrow="Tops des fiches"
          title="Captures remarquables"
          description={
            entryTotal.toLocaleString("fr-CH") +
            " fiche" +
            entryPlural +
            " classée" +
            entryPlural +
            ". Pour les vues et les J’aime, la période porte sur les événements enregistrés."
          }
        />
        <nav className="tabs ranking-tabs" aria-label="Métrique du classement des fiches">
          {metrics.map(({ value, label, icon: Icon }) => (
            <Link
              href={rankingsHref({ period, metric: value, trainerPage })}
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
            retryHref={rankingsHref({ period, metric, trainerPage, entryPage })}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Aucune fiche classée"
            description="Les statistiques de cette période ne contiennent pas encore de capture publique réelle."
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
        <RankingPagination
          label="Pages du classement des fiches"
          currentPage={entryPage}
          totalPages={entryTotalPages}
          previousHref={rankingsHref({
            period,
            metric,
            trainerPage,
            entryPage: entryPage - 1,
          })}
          nextHref={rankingsHref({
            period,
            metric,
            trainerPage,
            entryPage: entryPage + 1,
          })}
        />
      </section>
    </div>
  );
}
