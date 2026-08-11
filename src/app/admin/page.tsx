import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  FilePenLine,
  Handshake,
  Mail,
  MessageSquare,
  Medal,
  ScrollText,
  Send,
  Tags,
  Users,
} from "lucide-react";
import { getAdminDashboard } from "@/components/admin/admin-data";
import type {
  AdminDashboardDto,
  AdminMessageDto,
  EntrySummaryDto,
  ReviewDto,
} from "@/components/data/types";
import { serverApi, unwrapList, unwrapObject } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";
import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { getAdminQueueCounts } from "@/lib/services/admin-queues";

export const metadata: Metadata = { title: "Administration" };

function queueCount(value: unknown) {
  return typeof value === "number" ? value : 0;
}

export default async function AdminDashboardPage() {
  const currentUser = await getOptionalCurrentUser();
  if (currentUser?.role === "MODERATOR") redirect("/admin/moderation");
  const [result, entriesResult, reviewsResult, messagesResult, queueCounts] = await Promise.all([
    getAdminDashboard(),
    serverApi<unknown>("/api/admin/entries?status=PENDING_REVIEW&limit=5&offset=0"),
    serverApi<unknown>("/api/admin/reviews?status=PENDING_REVIEW&limit=5&offset=0"),
    serverApi<unknown>("/api/admin/messages?limit=5&offset=0"),
    currentUser ? getAdminQueueCounts(currentUser) : null,
  ]);
  const dashboard = unwrapObject<AdminDashboardDto>(result.data, ["dashboard"]);
  const pendingEntries = unwrapList<EntrySummaryDto>(entriesResult.data, ["entries"]);
  const pendingReviews = unwrapList<ReviewDto>(reviewsResult.data, ["reviews"]);
  const recentMessages = unwrapList<AdminMessageDto>(messagesResult.data, ["messages"]);
  const cards: Array<{
    key?: string;
    label: string;
    value: number | string;
    change?: number | string | null;
  }> = dashboard?.stats?.length
    ? dashboard.stats
    : [
        {
          key: "published",
          label: "Fiches publiées",
          value: queueCount(dashboard?.publishedEntries),
        },
        { key: "entries", label: "Fiches à valider", value: queueCount(dashboard?.pendingEntries) },
        { key: "reviews", label: "Avis à valider", value: queueCount(dashboard?.pendingReviews) },
        { key: "messages", label: "Messages ouverts", value: queueCount(dashboard?.openMessages) },
        {
          key: "partners",
          label: "Partenaires actifs",
          value: queueCount(dashboard?.activePartners),
        },
        { key: "members", label: "Membres", value: queueCount(dashboard?.members) },
        { key: "views", label: "Vues sur 30 jours", value: queueCount(dashboard?.views30d) },
      ];

  if (result.error || !dashboard) {
    return (
      <ErrorState
        message={result.error ?? "Le tableau de bord n’a pas renvoyé de données."}
        retryHref="/admin"
      />
    );
  }

  return (
    <>
      <header className="page-header page-header--compact">
        <div className="page-header__copy">
          <p className="eyebrow">Vue opérationnelle</p>
          <h1 className="page-title">Tableau de bord</h1>
          <p>Les files prioritaires et actions de modération en temps réel.</p>
        </div>
      </header>

      {queueCounts && (
        <section className="content-panel admin-attention-panel" aria-labelledby="attention-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Priorités</p>
              <h2 id="attention-title">À traiter maintenant</h2>
            </div>
            <strong className="admin-section-count">{queueCounts.totalActionable}</strong>
          </div>
          <div className="admin-attention-grid">
            <AttentionLink
              href="/admin/fiches"
              label="Fiches"
              count={queueCounts.pendingEntries}
              icon={<BookOpen aria-hidden="true" />}
            />
            <AttentionLink
              href="/admin/fiches#corrections"
              label="Corrections"
              count={queueCounts.pendingCorrections}
              icon={<FilePenLine aria-hidden="true" />}
            />
            <AttentionLink
              href="/admin/avis"
              label="Avis"
              count={queueCounts.pendingReviews}
              icon={<MessageSquare aria-hidden="true" />}
            />
            <AttentionLink
              href="/admin/messages"
              label="Messages"
              count={queueCounts.pendingMessages + queueCounts.pendingReports}
              icon={<Mail aria-hidden="true" />}
            />
            <AttentionLink
              href="/admin/concours"
              label="Concours"
              count={queueCounts.pendingContestParticipations}
              icon={<Medal aria-hidden="true" />}
            />
          </div>
        </section>
      )}

      <section className="admin-stat-grid" aria-label="Indicateurs administratifs">
        {cards.map((stat) => (
          <article className="admin-stat" key={stat.key ?? stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            {stat.change !== null && stat.change !== undefined && <small>{stat.change}</small>}
          </article>
        ))}
      </section>

      <div className="admin-dashboard-grid">
        <Queue
          title="Fiches en attente"
          href="/admin/fiches"
          icon={<BookOpen aria-hidden="true" />}
          items={pendingEntries}
          render={(entry) => (
            <>
              <div>
                <strong>{entry.name}</strong>
                <span>
                  {entry.category?.name ?? entry.categoryName ?? "Sans catégorie"} ·{" "}
                  {formatDate(entry.createdAt)}
                </span>
              </div>
              <StatusPill value={entry.status} />
            </>
          )}
        />
        <Queue
          title="Avis en attente"
          href="/admin/avis"
          icon={<MessageSquare aria-hidden="true" />}
          items={pendingReviews}
          render={(review) => (
            <>
              <div>
                <strong>{review.entry?.name ?? review.entryName ?? "Fiche inconnue"}</strong>
                <span>
                  {review.author?.displayName ?? review.authorDisplayNameSnapshot ?? "Dresseur"} ·{" "}
                  {review.overallRating}/10
                </span>
              </div>
              <StatusPill value={review.status} />
            </>
          )}
        />
        <Queue
          title="Messages récents"
          href="/admin/messages"
          icon={<Mail aria-hidden="true" />}
          items={recentMessages}
          render={(message) => (
            <>
              <div>
                <strong>{message.subject}</strong>
                <span>
                  {message.authorDisplayName ?? message.authorDisplayNameSnapshot ?? "Visiteur"} ·{" "}
                  {formatDate(message.createdAt)}
                </span>
              </div>
              <StatusPill value={message.status} />
            </>
          )}
        />
        <QuickLink
          href="/admin/categories"
          title="Catégories"
          description="Gérer la taxonomie et les champs dynamiques."
          icon={<Tags aria-hidden="true" />}
        />
        <QuickLink
          href="/admin/publications"
          title="Publications Telegram"
          description="Prévisualiser et envoyer les contenus éditoriaux."
          icon={<Send aria-hidden="true" />}
        />
        <QuickLink
          href="/admin/utilisateurs"
          title="Utilisateurs & équipe"
          description="Administrer les rôles et les suspensions."
          icon={<Users aria-hidden="true" />}
        />
        <QuickLink
          href="/admin/partenaires"
          title="Partenaires"
          description="Gérer la visibilité et la mise en avant."
          icon={<Handshake aria-hidden="true" />}
        />
        <QuickLink
          href="/admin/journal"
          title="Journal d’audit"
          description="Contrôler la trace des actions sensibles."
          icon={<ScrollText aria-hidden="true" />}
        />
      </div>
    </>
  );
}

function AttentionLink({
  href,
  label,
  count,
  icon,
}: {
  href: string;
  label: string;
  count: number;
  icon: ReactNode;
}) {
  return (
    <Link
      className="admin-attention-link"
      href={href}
      aria-label={`${label} : ${count} en attente`}
    >
      {icon}
      <span>{label}</span>
      <strong>{count > 99 ? "99+" : count}</strong>
    </Link>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <section className="content-panel admin-quick-links">
      <h2>
        {icon} {title}
      </h2>
      <p>{description}</p>
      <Link className="button button--secondary" href={href}>
        Ouvrir la gestion
      </Link>
    </section>
  );
}

function Queue<T extends EntrySummaryDto | ReviewDto | AdminMessageDto>({
  title,
  href,
  icon,
  items,
  render,
}: {
  title: string;
  href: string;
  icon: ReactNode;
  items: T[];
  render: (item: T) => ReactNode;
}) {
  return (
    <section className="content-panel admin-queue">
      <header>
        <h2>
          {icon} {title}
        </h2>
        <Link className="text-link" href={href}>
          Tout voir <span aria-hidden="true">→</span>
        </Link>
      </header>
      {items.length ? (
        <div className="admin-queue__list">
          {items.slice(0, 5).map((item) => (
            <article key={String(item.id)}>{render(item)}</article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="File vide"
          description="Aucun élément ne demande d’action pour le moment."
        />
      )}
    </section>
  );
}
