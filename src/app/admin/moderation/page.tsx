import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail, Medal, MessageSquare, ShieldCheck } from "lucide-react";

import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminQueueCounts } from "@/lib/services/admin-queues";

export const metadata: Metadata = { title: "Modération" };

type ModerationCard = {
  href: string;
  label: string;
  description: string;
  count: number;
  icon: typeof BookOpen;
};

export default async function ModerationDashboardPage() {
  const actor = await requireAdminUser();
  const counts = await getAdminQueueCounts(actor);

  const cards: ModerationCard[] = [
    {
      href: "/admin/fiches",
      label: "Fiches à valider",
      description: "Approuver, demander des corrections ou refuser les propositions.",
      count: counts.pendingEntries,
      icon: BookOpen,
    },
    {
      href: "/admin/fiches#corrections",
      label: "Corrections proposées",
      description: "Lire les modifications suggérées sur les fiches déjà publiées.",
      count: counts.pendingCorrections,
      icon: BookOpen,
    },
    {
      href: "/admin/avis",
      label: "Avis à valider",
      description: "Contrôler les avis avant leur publication.",
      count: counts.pendingReviews,
      icon: MessageSquare,
    },
    {
      href: "/admin/messages",
      label: "Messages et signalements",
      description: "Traiter les demandes et contenus signalés.",
      count: counts.pendingMessages,
      icon: Mail,
    },
    {
      href: "/admin/messages?type=REPORT",
      label: "Signalements",
      description: "Prioriser les contenus et comportements signalés par la communauté.",
      count: counts.pendingReports,
      icon: Mail,
    },
    {
      href: "/admin/concours",
      label: "Participations aux concours",
      description: "Examiner les candidatures et attribuer les scores autorisés.",
      count: counts.pendingContestParticipations,
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

      {(counts.requestedEntryChanges > 0 || counts.requestedReviewChanges > 0) && (
        <section className="content-panel admin-waiting-summary" aria-label="Retours demandés">
          <div>
            <p className="eyebrow">En attente des membres</p>
            <h2>Modifications déjà demandées</h2>
            <p>Ces éléments reviendront dans la file active après leur nouvelle soumission.</p>
          </div>
          <div className="button-row">
            <span className="status-pill">{counts.requestedEntryChanges} fiche(s)</span>
            <span className="status-pill">{counts.requestedReviewChanges} avis</span>
          </div>
        </section>
      )}
    </>
  );
}
