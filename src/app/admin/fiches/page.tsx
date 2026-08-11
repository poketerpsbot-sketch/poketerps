import type { Metadata } from "next";
import Link from "next/link";
import { AdminModerationActions } from "@/components/admin/admin-actions";
import type { EntrySummaryDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";
import { requireAdminUser } from "@/lib/auth/admin";
import { listPendingCorrections } from "@/lib/services/admin-queues";

export const metadata: Metadata = { title: "Fiches à valider" };

export default async function AdminEntriesPage() {
  await requireAdminUser("entry:moderate");
  const [result, corrections] = await Promise.all([
    serverApi<unknown>("/api/admin/entries?status=PENDING_REVIEW&limit=50&offset=0"),
    listPendingCorrections(50),
  ]);
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
                  { status: "APPROVED", label: "Approuver" },
                  { status: "REJECTED", label: "Rejeter", tone: "danger" },
                ]}
              />
            </article>
          ))}
        </div>
      )}

      <section className="page-stack admin-correction-queue" id="corrections">
        <div className="section-heading section-heading--panel">
          <div>
            <p className="eyebrow">Communauté</p>
            <h2>Corrections proposées</h2>
            <p>
              Vérifie chaque suggestion et la fiche liée. Une acceptation valide la proposition dans
              son historique ; les changements sensibles restent à appliquer manuellement.
            </p>
          </div>
          <strong className="admin-section-count" aria-label={`${corrections.length} en attente`}>
            {corrections.length}
          </strong>
        </div>
        {corrections.length === 0 ? (
          <EmptyState
            title="Aucune correction proposée"
            description="Toutes les propositions de la communauté ont été traitées."
          />
        ) : (
          <div className="admin-list">
            {corrections.map((correction) => (
              <article className="content-panel admin-list__item" key={correction.id}>
                <div className="admin-list__copy">
                  <div className="button-row">
                    <StatusPill value="PENDING_REVIEW" />
                    <span>{formatDate(correction.submittedAt)}</span>
                  </div>
                  <h3>{correction.title}</h3>
                  <p>{correction.summary ?? "Aucun résumé fourni."}</p>
                  <p className="muted">
                    Proposée par {correction.author.displayName}
                    {correction.author.username ? ` · @${correction.author.username}` : ""}
                  </p>
                  {correction.entry && (
                    <Link className="text-link" href={`/fiches/${correction.entry.slug}`}>
                      Vérifier la fiche « {correction.entry.name} »{" "}
                      <span aria-hidden="true">→</span>
                    </Link>
                  )}
                  <dl className="admin-correction-changes">
                    {correction.changes.map((change, index) => (
                      <div key={`${correction.id}-${change.fieldPath}-${index}`}>
                        <dt>{correctionFieldLabel(change.fieldPath)}</dt>
                        <dd>{displayCorrectionValue(change.proposedValue)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <AdminModerationActions
                  endpoint={`/api/admin/submissions/${encodeURIComponent(correction.id)}`}
                  reasonRequired
                  actions={[
                    {
                      status: "CHANGES_REQUESTED",
                      label: "Demander des précisions",
                      tone: "secondary",
                    },
                    { status: "APPROVED", label: "Marquer acceptée" },
                    { status: "REJECTED", label: "Refuser", tone: "danger" },
                  ]}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

const correctionLabels: Record<string, string> = {
  name: "Nom",
  shortDescription: "Résumé",
  fullDescription: "Description complète",
  category: "Catégorie",
  subcategory: "Sous-catégorie",
  micron: "Microns",
  fields: "Caractéristique",
  images: "Image",
  other: "Autre élément",
};

function correctionFieldLabel(fieldPath: string): string {
  return correctionLabels[fieldPath] ?? fieldPath.replaceAll("_", " ");
}

function displayCorrectionValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "Valeur vide";
  try {
    return JSON.stringify(value);
  } catch {
    return "Valeur non affichable";
  }
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
