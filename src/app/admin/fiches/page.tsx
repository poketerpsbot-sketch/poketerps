import type { Metadata } from "next";
import Link from "next/link";
import { AdminModerationActions } from "@/components/admin/admin-actions";
import type { EntrySummaryDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Fiches à valider" };

export default async function AdminEntriesPage() {
  const result = await serverApi<unknown>(
    "/api/admin/entries?status=PENDING_REVIEW&limit=50&offset=0",
  );
  const entries = unwrapList<EntrySummaryDto>(result.data, ["entries"]);
  return (
    <>
      <AdminHeader
        eyebrow="Modération éditoriale"
        title="Fiches à valider"
        description="Contrôle les informations, médias et sources avant publication."
      />
      {result.error ? (
        <ErrorState message={result.error} retryHref="/admin/fiches" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Aucune fiche en attente"
          description="La file de validation est à jour."
        />
      ) : (
        <div className="admin-list">
          {entries.map((entry) => (
            <article className="content-panel admin-list__item" key={String(entry.id)}>
              <div className="admin-list__copy">
                <div className="button-row">
                  <StatusPill value={entry.status} />
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
                <h2>{entry.name}</h2>
                <p>{entry.shortDescription ?? "Aucune description courte."}</p>
                <Link className="text-link" href={`/fiches/${entry.slug}`}>
                  Consulter la fiche <span aria-hidden="true">→</span>
                </Link>
              </div>
              <AdminModerationActions
                endpoint={`/api/admin/entries/${encodeURIComponent(String(entry.id))}`}
                reasonRequired
                actions={[
                  {
                    status: "CHANGES_REQUESTED",
                    label: "Demander des corrections",
                    tone: "secondary",
                  },
                  { status: "PUBLISHED", label: "Publier" },
                  { status: "REJECTED", label: "Rejeter", tone: "danger" },
                ]}
              />
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function AdminHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-header page-header--compact">
      <div className="page-header__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}
