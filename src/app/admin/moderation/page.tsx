import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail, Medal, MessageSquare, ShieldCheck } from "lucide-react";

import type { AdminMessageDto, EntrySummaryDto, ReviewDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Modération" };

type ModerationCard = {
  href: string;
  label: string;
  description: string;
  count: number;
  icon: typeof BookOpen;
};

export default async function ModerationDashboardPage() {
  const [entriesResult, reviewsResult, messagesResult, contestsResult] = await Promise.all([
    serverApi<unknown>("/api/admin/entries?status=PENDING_REVIEW&limit=10&offset=0"),
    serverApi<unknown>("/api/admin/reviews?status=PENDING_REVIEW&limit=10&offset=0"),
    serverApi<unknown>("/api/admin/messages?status=NEW&limit=10&offset=0"),
    serverApi<unknown>("/api/admin/contests?limit=20&offset=0"),
  ]);

  const firstError =
    entriesResult.error ?? reviewsResult.error ?? messagesResult.error ?? contestsResult.error;
  if (firstError) return <ErrorState message={firstError} retryHref="/admin/moderation" />;

  const entries = unwrapList<EntrySummaryDto>(entriesResult.data, ["entries"]);
  const reviews = unwrapList<ReviewDto>(reviewsResult.data, ["reviews"]);
  const messages = unwrapList<AdminMessageDto>(messagesResult.data, ["messages"]);
  const contests = unwrapList<Record<string, unknown>>(contestsResult.data, ["contests"]);
  const pendingContests = contests.reduce(
    (total, contest) => total + Number(contest.pending_count ?? contest.pendingCount ?? 0),
    0,
  );

  const cards: ModerationCard[] = [
    {
      href: "/admin/fiches",
      label: "Fiches à valider",
      description: "Approuver, demander des corrections ou refuser les propositions.",
      count: entries.length,
      icon: BookOpen,
    },
    {
      href: "/admin/avis",
      label: "Avis à valider",
      description: "Contrôler les avis avant leur publication.",
      count: reviews.length,
      icon: MessageSquare,
    },
    {
      href: "/admin/messages",
      label: "Messages et signalements",
      description: "Traiter les demandes et contenus signalés.",
      count: messages.length,
      icon: Mail,
    },
    {
      href: "/admin/concours",
      label: "Participations aux concours",
      description: "Examiner les candidatures et attribuer les scores autorisés.",
      count: pendingContests,
      icon: Medal,
    },
  ];

  return (
    <>
      <header className="page-header page-header--compact">
        <div className="page-header__copy">
          <p className="eyebrow">Équipe autorisée</p>
          <h1 className="page-title">Centre de modération</h1>
          <p>
            Les modérateurs voient uniquement les files qu’ils ont le droit de traiter. Toutes les
            actions restent journalisées.
          </p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>

      <section className="admin-dashboard-grid" aria-label="Files de modération">
        {cards.map(({ href, label, description, count, icon: Icon }) => (
          <article className="content-panel admin-quick-links" key={href}>
            <h2>
              <Icon aria-hidden="true" /> {label}
            </h2>
            <strong className="admin-moderation-count">{count}</strong>
            <p>{description}</p>
            <Link className="button button--secondary" href={href}>
              Ouvrir la file
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}
