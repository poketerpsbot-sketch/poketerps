import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
import {
  PublicationActions,
  PublicationComposer,
  type AdminPublication,
  type PublicationTarget,
} from "@/components/admin/publication-admin";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Publications Telegram · Administration" };

export default async function AdminPublicationsPage() {
  const [publicationResult, entryResult, partnerResult] = await Promise.all([
    serverApi<unknown>("/api/admin/publications?limit=100&offset=0"),
    serverApi<unknown>("/api/admin/entries?status=PUBLISHED&limit=100&offset=0"),
    serverApi<unknown>("/api/admin/partners?limit=100&offset=0"),
  ]);
  const publications = unwrapList<AdminPublication>(publicationResult.data, ["publications"]);
  const entries = unwrapList<PublicationTarget>(entryResult.data, ["entries"]).map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
  const partners = unwrapList<PublicationTarget>(partnerResult.data, ["partners"]).map(
    (partner) => ({ id: partner.id, name: partner.name }),
  );

  return (
    <>
      <AdminHeader
        eyebrow="Canal éditorial"
        title="Publications Telegram"
        description="Prépare, prévisualise et publie les fiches, partenaires et annonces sur le canal configuré."
      />
      <PublicationComposer entries={entries} partners={partners} />
      {(entryResult.error || partnerResult.error) && (
        <p className="admin-action-feedback" role="alert">
          Certaines cibles n’ont pas pu être chargées : {entryResult.error ?? partnerResult.error}
        </p>
      )}
      {publicationResult.error ? (
        <ErrorState message={publicationResult.error} retryHref="/admin/publications" />
      ) : publications.length === 0 ? (
        <EmptyState
          title="Aucune publication"
          description="Crée un premier brouillon avec le formulaire ci-dessus."
        />
      ) : (
        <div className="admin-list">
          {publications.map((publication) => (
            <article className="content-panel admin-list__item" key={String(publication.id)}>
              <div className="admin-list__copy">
                <div className="button-row">
                  <StatusPill value={publication.status} />
                  <span>{publication.type.toLocaleLowerCase("fr-FR")}</span>
                  <span>{formatDate(publication.createdAt)}</span>
                </div>
                <h2>{publication.entryName ?? publication.partnerName ?? "Annonce éditoriale"}</h2>
                {publication.type === "ANNOUNCEMENT" &&
                  typeof publication.previewPayload?.text === "string" && (
                    <p>{publication.previewPayload.text}</p>
                  )}
                <dl className="data-list">
                  <div>
                    <dt>Planification</dt>
                    <dd>
                      {publication.scheduledAt
                        ? formatDate(publication.scheduledAt)
                        : "Envoi manuel"}
                    </dd>
                  </div>
                  <div>
                    <dt>Publication</dt>
                    <dd>
                      {publication.publishedAt
                        ? formatDate(publication.publishedAt)
                        : "Pas encore publiée"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tentatives</dt>
                    <dd>{publication.attemptCount ?? 0}</dd>
                  </div>
                </dl>
              </div>
              <PublicationActions publication={publication} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
