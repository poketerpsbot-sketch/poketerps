import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import type { EntrySummaryDto, PublicProfileDto } from "@/components/data/types";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatCount } from "@/components/ui/states";

export const metadata: Metadata = { title: "Statistiques · Administration" };

type AdminStats = {
  publishedEntries?: number;
  pendingEntries?: number;
  pendingReviews?: number;
  openMessages?: number;
  activePartners?: number;
  members?: number;
  views30d?: number;
  totalUsers?: number;
  activeUsers?: number;
  newUsers30d?: number;
  capturesWeek?: number;
  capturesMonth?: number;
  totalViews?: number;
  viewsToday?: number;
  totalLikes?: number;
  totalReviews?: number;
  unreadMessages?: number;
  inProgressMessages?: number;
  partnerClicks?: number;
  telegramPublications?: number;
  topTrainers?: Array<PublicProfileDto & { captures?: number }>;
  popularEntries?: Array<EntrySummaryDto & { metricValue?: number | string | null }>;
};

export default async function AdminStatsPage() {
  const result = await serverApi<unknown>("/api/admin/stats");
  const stats = unwrapObject<AdminStats>(result.data, ["stats"]);
  const metrics = stats
    ? [
        ["Utilisateurs", stats.totalUsers ?? stats.members],
        ["Utilisateurs actifs", stats.activeUsers],
        ["Nouveaux utilisateurs (30 j)", stats.newUsers30d],
        ["Fiches publiées", stats.publishedEntries],
        ["Fiches à valider", stats.pendingEntries],
        ["Captures cette semaine", stats.capturesWeek],
        ["Captures ce mois", stats.capturesMonth],
        ["Vues totales", stats.totalViews],
        ["Vues aujourd’hui", stats.viewsToday],
        ["Vues sur 30 jours", stats.views30d],
        ["J’aime", stats.totalLikes],
        ["Avis", stats.totalReviews],
        ["Avis à valider", stats.pendingReviews],
        ["Messages ouverts", stats.openMessages],
        ["Messages non lus", stats.unreadMessages],
        ["Messages en cours", stats.inProgressMessages],
        ["Partenaires actifs", stats.activePartners],
        ["Clics partenaires", stats.partnerClicks],
        ["Publications Telegram", stats.telegramPublications],
      ].filter((metric): metric is [string, number] => typeof metric[1] === "number")
    : [];

  return (
    <>
      <AdminHeader
        eyebrow="Mesure de l’activité"
        title="Statistiques"
        description="Indicateurs calculés depuis les événements réels de la plateforme, sans estimation ni donnée fictive."
      />
      {result.error || !stats ? (
        <ErrorState
          message={result.error ?? "Les statistiques n’ont pas été renvoyées."}
          retryHref="/admin/statistiques"
        />
      ) : metrics.length === 0 ? (
        <EmptyState
          title="Aucune mesure disponible"
          description="Les indicateurs apparaîtront après les premières activités."
        />
      ) : (
        <>
          <section className="admin-stat-grid" aria-label="Indicateurs administratifs">
            {metrics.map(([label, value]) => (
              <article className="admin-stat" key={label}>
                <span>{label}</span>
                <strong>{formatCount(value)}</strong>
              </article>
            ))}
          </section>
          {(stats.topTrainers?.length || stats.popularEntries?.length) && (
            <div className="admin-dashboard-grid">
              {stats.topTrainers?.length ? (
                <section className="content-panel admin-ranking-list">
                  <h2>Meilleurs dresseurs</h2>
                  <ol>
                    {stats.topTrainers.map((trainer) => (
                      <li key={String(trainer.id ?? trainer.publicSlug)}>
                        <Link
                          href={`/profil/${encodeURIComponent(trainer.publicSlug ?? trainer.slug ?? "")}`}
                        >
                          {trainer.displayName}
                        </Link>
                        <strong>
                          {formatCount(trainer.captures ?? trainer.captureCount)} captures
                        </strong>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
              {stats.popularEntries?.length ? (
                <section className="content-panel admin-ranking-list">
                  <h2>Fiches populaires</h2>
                  <ol>
                    {stats.popularEntries.map((entry) => (
                      <li key={String(entry.id)}>
                        <Link href={`/fiches/${entry.slug}`}>{entry.name}</Link>
                        <strong>
                          {formatCount(Number(entry.metricValue ?? entry.viewCount ?? 0))} vues
                        </strong>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          )}
        </>
      )}
    </>
  );
}
