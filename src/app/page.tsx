import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  AtSign,
  MessageCircle,
  Radio,
  Search,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import type { HomeDto, TrainerRankingDto } from "@/components/data/types";
import { CategoryGrid } from "@/components/entries/category-card";
import { EntryGrid } from "@/components/entries/entry-card";
import { PartnerCard, PartnerGrid } from "@/components/partners/partner-card";
import { EmptyState, ErrorState, SectionHeading } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Accueil",
};

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

function trainerCaptures(ranking: TrainerRankingDto) {
  return Number(ranking.captures ?? ranking.periodCaptures ?? 0);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function safeUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const result = await serverApi<unknown>("/api/home");
  const home = unwrapObject<HomeDto>(result.data, ["home"]);
  const latest = home?.latestEntries ?? home?.latest ?? [];
  const popular = home?.popularEntries ?? [];
  const mostViewed = home?.mostViewedEntries ?? home?.mostViewed ?? [];
  const mostLiked = home?.mostLikedEntries ?? home?.mostLiked ?? [];
  const topRated = home?.topRatedEntries ?? home?.bestRated ?? [];
  const categories = home?.categories ?? [];
  const topTrainers = home?.topTrainers ?? [];
  const featuredPartner = home?.featuredPartner ?? home?.featuredPartners?.[0] ?? null;
  const partners = (home?.partners ?? home?.featuredPartners ?? []).filter(
    (partner) => partner.id !== featuredPartner?.id,
  );
  const recentContributors = home?.recentContributors ?? [];
  const social = {
    channel: safeUrl(home?.socialLinks?.telegramChannel ?? process.env.TELEGRAM_CHANNEL_URL),
    chat: safeUrl(home?.socialLinks?.telegramChat ?? process.env.TELEGRAM_CHAT_URL),
    instagram: safeUrl(home?.socialLinks?.instagram ?? process.env.INSTAGRAM_URL),
  };

  return (
    <div className="page-shell page-stack">
      <section className="hero device-panel">
        <div className="hero__copy">
          <p className="eyebrow">Base communautaire · signal public</p>
          <h1>
            Complète ton Pokédex<span>Découvre · documente · partage</span>
          </h1>
          <p>
            Explore des fiches éditoriales, consulte les avis vérifiés et contribue aux archives
            comme Dresseur.
          </p>
          <form className="hero__actions" action="/recherche" method="get" role="search">
            <label className="sr-only" htmlFor="home-query">
              Scanner le Pokédex
            </label>
            <input
              id="home-query"
              name="query"
              className="hero-search-input"
              placeholder="Nom, numéro, catégorie…"
            />
            <button className="button button--dark" type="submit">
              <Search size={17} aria-hidden="true" /> Scanner
            </button>
            <Link className="button button--secondary" href="/capturer">
              ＋ Proposer une capture
            </Link>
          </form>
        </div>
        <div className="hero__scanner" aria-hidden="true">
          <span className="scanner-orbit" />
          <span className="scanner-line" />
          <div className="scanner-content">
            <span className="pokeball" />
            <strong>SCAN COMMUNAUTAIRE</strong>
            <small>CONNEXION AUX ARCHIVES</small>
          </div>
        </div>
      </section>

      {result.error ? (
        <ErrorState message={result.error} retryHref="/" />
      ) : (
        <>
          <section className="section-stack">
            <SectionHeading
              eyebrow="Nouvelles données"
              title="Dernières captures"
              description="Les découvertes récemment vérifiées et publiées."
              action={{ href: "/catalogue?sort=recent", label: "Tout voir" }}
            />
            {latest.length > 0 ? (
              <EntryGrid entries={latest} />
            ) : (
              <EmptyState action={{ href: "/capturer", label: "Proposer la première" }} />
            )}
          </section>

          {popular.length > 0 && (
            <section className="section-stack">
              <SectionHeading
                eyebrow="Signal communautaire"
                title="Captures populaires"
                action={{ href: "/catalogue?sort=views", label: "Explorer" }}
              />
              <EntryGrid entries={popular} />
            </section>
          )}

          {categories.length > 0 && (
            <section className="section-stack">
              <SectionHeading
                eyebrow="Taxonomie vivante"
                title="Parcourir les catégories"
                description="Les catégories et sous-catégories sont administrées dynamiquement."
                action={{ href: "/explorer", label: "Explorer" }}
              />
              <CategoryGrid categories={categories} />
            </section>
          )}

          {(mostViewed.length > 0 || mostLiked.length > 0 || topRated.length > 0) && (
            <div className="home-rank-sections">
              {mostViewed.length > 0 && (
                <section className="section-stack">
                  <SectionHeading
                    eyebrow="Télémétrie"
                    title="Les plus vues"
                    action={{
                      href: "/classements?tab=entries&metric=views&period=all",
                      label: "Classement",
                    }}
                  />
                  <EntryGrid entries={mostViewed} />
                </section>
              )}
              {mostLiked.length > 0 && (
                <section className="section-stack">
                  <SectionHeading
                    eyebrow="Coup de cœur"
                    title="Les plus aimées"
                    action={{
                      href: "/classements?tab=entries&metric=likes&period=all",
                      label: "Classement",
                    }}
                  />
                  <EntryGrid entries={mostLiked} />
                </section>
              )}
              {topRated.length > 0 && (
                <section className="section-stack">
                  <SectionHeading
                    eyebrow="Avis vérifiés"
                    title="Les mieux notées"
                    action={{
                      href: "/classements?tab=entries&metric=rating&period=all",
                      label: "Classement",
                    }}
                  />
                  <EntryGrid entries={topRated} />
                </section>
              )}
            </div>
          )}

          {topTrainers.length > 0 && (
            <section className="rank-section screen-panel">
              <SectionHeading
                eyebrow="Cette semaine"
                title="Top Dresseurs"
                description="Seules les captures validées et publiées comptent."
                action={{ href: "/classements", label: "Classement complet" }}
              />
              <div className="rank-list">
                {topTrainers.map((item, index) => {
                  const profile = trainerProfile(item);
                  return (
                    <Link
                      className="rank-row"
                      href={`/profil/${encodeURIComponent(profile.publicSlug ?? String(profile.id ?? ""))}`}
                      key={`${item.rank}-${profile.publicSlug ?? index}`}
                    >
                      <span className="rank-row__rank">{item.rank ?? index + 1}</span>
                      <span className="avatar" aria-hidden="true">
                        {initials(profile.displayName)}
                      </span>
                      <span className="rank-row__copy">
                        <h3>{profile.displayName}</h3>
                        <p>
                          {profile.telegramUsername
                            ? `@${profile.telegramUsername}`
                            : (profile.profileTitle ?? "Dresseur")}
                        </p>
                      </span>
                      <strong className="rank-row__value">{trainerCaptures(item)} captures</strong>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {featuredPartner && (
            <section className="section-stack">
              <SectionHeading
                eyebrow="Fréquence alliée"
                title="Partenaire à la une"
                action={{ href: "/partenaires", label: "Tous les partenaires" }}
              />
              <PartnerCard partner={featuredPartner} />
            </section>
          )}

          {partners.length > 0 && (
            <section className="section-stack">
              <SectionHeading
                eyebrow="Réseau"
                title="Nos partenaires"
                action={{ href: "/partenaires", label: "Découvrir" }}
              />
              <PartnerGrid partners={partners} />
            </section>
          )}

          {recentContributors.length > 0 && (
            <section className="section-stack">
              <SectionHeading eyebrow="Nouveaux signaux" title="Dresseurs récents" />
              <div className="profile-grid">
                {recentContributors.map((profile) => (
                  <Link
                    className="profile-card list-row"
                    href={`/profil/${encodeURIComponent(profile.publicSlug ?? String(profile.id ?? ""))}`}
                    key={String(profile.id ?? profile.publicSlug)}
                  >
                    <span className="avatar" aria-hidden="true">
                      {initials(profile.displayName)}
                    </span>
                    <span className="list-row__copy">
                      <h3>{profile.displayName}</h3>
                      <p>
                        {profile.telegramUsername
                          ? `@${profile.telegramUsername}`
                          : (profile.profileTitle ?? "Dresseur")}
                      </p>
                    </span>
                    <span className="list-row__meta">{profile.captureCount ?? 0} captures</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {(social.channel || social.chat || social.instagram) && (
        <section className="social-console device-panel">
          <div>
            <p className="eyebrow">Rester connecté</p>
            <h2>Rejoins la communauté</h2>
            <p>Les canaux externes s’ouvrent dans leur application respective.</p>
          </div>
          <div className="button-row">
            {social.channel && (
              <a
                className="button button--secondary"
                href={social.channel}
                target="_blank"
                rel="noreferrer"
              >
                <Send size={17} aria-hidden="true" /> Canal Telegram{" "}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
            {social.chat && (
              <a
                className="button button--secondary"
                href={social.chat}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={17} aria-hidden="true" /> Chat Telegram{" "}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
            {social.instagram && (
              <a
                className="button button--secondary"
                href={social.instagram}
                target="_blank"
                rel="noreferrer"
              >
                <AtSign size={17} aria-hidden="true" /> Instagram{" "}
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
            <Link className="button button--dark" href="/classements">
              <Trophy size={17} aria-hidden="true" /> Classements
            </Link>
          </div>
          <span className="social-console__signal" aria-hidden="true">
            <Radio />
            <Users />
          </span>
        </section>
      )}
    </div>
  );
}
