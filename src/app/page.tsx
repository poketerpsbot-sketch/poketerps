import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Gift, Trophy } from "lucide-react";

import { serverApi, unwrapObject } from "@/components/data/server-api";
import type { HomeDto, TrainerRankingDto } from "@/components/data/types";
import { EntryGrid } from "@/components/entries/entry-card";
import { HomeScanner } from "@/components/home/home-scanner";
import { PartnerCard } from "@/components/partners/partner-card";
import { EmptyState, ErrorState, SectionHeading } from "@/components/ui/states";

export const metadata: Metadata = { title: "Accueil" };

function trainerProfile(ranking: TrainerRankingDto) {
  return (
    ranking.user ??
    ranking.profile ?? {
      displayName: ranking.displayName ?? "Dresseur",
      publicSlug: ranking.publicSlug ?? ranking.slug,
      telegramUsername: ranking.telegramUsername ?? ranking.username,
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

export default async function HomePage() {
  const result = await serverApi<unknown>("/api/home");
  const home = unwrapObject<HomeDto>(result.data, ["home"]);
  const latest = home?.latest ?? home?.latestEntries ?? [];
  const trending = home?.trendingEntries ?? home?.mostViewed ?? [];
  const trainers = home?.topTrainers ?? [];
  const featuredPartner = home?.featuredPartner ?? home?.featuredPartners?.[0] ?? null;
  const viewer = home?.viewer;

  return (
    <div className="page-shell page-stack home-dashboard">
      <section className="home-welcome content-panel">
        <div>
          <p className="eyebrow">Archives communautaires</p>
          <h1>
            {viewer
              ? `Bienvenue, ${viewer.telegramUsername ? `@${viewer.telegramUsername}` : viewer.displayName}`
              : "Bienvenue dans le Pokédex"}
          </h1>
          <p>
            {viewer
              ? `Niveau ${viewer.level ?? 1} · ${viewer.profileTitle ?? "Dresseur"}`
              : "Découvre, documente et partage des fiches vérifiées par la communauté."}
          </p>
        </div>
        {viewer?.progress && (
          <div className="xp-compact">
            <div className="xp-compact__labels">
              <strong>
                {viewer.experiencePoints ?? 0} / {viewer.progress.nextThreshold} XP
              </strong>
              <span>
                {viewer.progress.remaining} XP avant le niveau {(viewer.level ?? 1) + 1}
              </span>
            </div>
            <div
              className="xp-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(viewer.progress.percent)}
            >
              <span style={{ width: `${viewer.progress.percent}%` }} />
            </div>
            <Link href="/profil">Voir ma progression</Link>
          </div>
        )}
      </section>

      {result.error || !home ? (
        <ErrorState
          message={result.error ?? "L’accueil est momentanément indisponible."}
          retryHref="/"
        />
      ) : (
        <>
          {home.sinceLastVisit && (
            <details className="home-return-summary content-panel">
              <summary>
                <BellRing aria-hidden="true" /> Depuis ta dernière visite
              </summary>
              <div className="home-return-summary__items">
                {home.sinceLastVisit.newEntries > 0 && (
                  <span>
                    <strong>{home.sinceLastVisit.newEntries}</strong> nouvelle(s) fiche(s)
                  </span>
                )}
                {home.sinceLastVisit.newContests > 0 && (
                  <span>
                    <strong>{home.sinceLastVisit.newContests}</strong> nouveau(x) concours
                  </span>
                )}
                {home.sinceLastVisit.approvedReviews > 0 && (
                  <span>
                    <strong>{home.sinceLastVisit.approvedReviews}</strong> avis approuvé(s)
                  </span>
                )}
                {home.sinceLastVisit.xpGained > 0 && (
                  <span>
                    <strong>+{home.sinceLastVisit.xpGained}</strong> XP
                  </span>
                )}
              </div>
            </details>
          )}

          <HomeScanner
            dailyDiscovery={home.dailyDiscovery}
            trendingEntries={trending}
            contest={home.activeContest}
            viewer={viewer}
            trainer={trainers[0]}
            publishedEntryCount={home.publishedEntryCount ?? 0}
          />

          {home.activeContest && (
            <section className="home-feature-card content-panel">
              <Gift aria-hidden="true" />
              <div>
                <p className="eyebrow">Concours actif</p>
                <h2>{home.activeContest.title}</h2>
                <p>{home.activeContest.summary ?? "Les inscriptions sont ouvertes."}</p>
              </div>
              <Link
                className="button"
                href={`/concours/${encodeURIComponent(home.activeContest.slug)}`}
              >
                Voir le concours
              </Link>
            </section>
          )}

          {home.dailyDiscovery && (
            <section className="section-stack">
              <SectionHeading eyebrow="Pokédex du jour" title="Découverte du jour" />
              <EntryGrid entries={[home.dailyDiscovery]} />
            </section>
          )}

          <section className="section-stack">
            <SectionHeading
              eyebrow="Signal communautaire"
              title="Tendances"
              action={{ href: "/explorer?sort=views", label: "Voir plus" }}
            />
            {trending.length ? <EntryGrid entries={trending.slice(0, 3)} /> : <EmptyState />}
          </section>

          <section className="section-stack">
            <SectionHeading
              eyebrow="Nouvelles données"
              title="Dernières captures"
              action={{ href: "/explorer?sort=recent", label: "Voir plus" }}
            />
            {latest.length ? (
              <EntryGrid entries={latest.slice(0, 3)} />
            ) : (
              <EmptyState action={{ href: "/capturer", label: "Proposer une capture" }} />
            )}
          </section>

          {trainers.length > 0 && (
            <section className="rank-section screen-panel">
              <SectionHeading
                eyebrow="Cette semaine"
                title="Top 3 Dresseurs"
                action={{ href: "/classements", label: "Voir plus" }}
              />
              <div className="rank-list">
                {trainers.slice(0, 3).map((item, index) => {
                  const profile = trainerProfile(item);
                  return (
                    <Link
                      className="rank-row"
                      href={`/profil/${encodeURIComponent(profile.publicSlug ?? String(profile.id ?? ""))}`}
                      key={`${item.rank}-${index}`}
                    >
                      <span className="rank-row__rank">
                        <Trophy size={16} aria-hidden="true" /> {item.rank ?? index + 1}
                      </span>
                      <span className="avatar" aria-hidden="true">
                        {initials(profile.displayName)}
                      </span>
                      <span className="rank-row__copy">
                        <h3>{profile.displayName}</h3>
                        <p>{profile.profileTitle ?? "Dresseur"}</p>
                      </span>
                      <strong className="rank-row__value">
                        {item.captures ?? item.periodCaptures ?? 0} captures
                      </strong>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {featuredPartner && (
            <section className="section-stack">
              <SectionHeading
                eyebrow="Partenaire à la une"
                title={featuredPartner.name}
                action={{ href: "/partenaires", label: "Tous les partenaires" }}
              />
              <PartnerCard partner={featuredPartner} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
