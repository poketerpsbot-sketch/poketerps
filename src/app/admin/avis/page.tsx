import type { Metadata } from "next";
import Link from "next/link";
import { AdminModerationActions } from "@/components/admin/admin-actions";
import type { ReviewDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Avis à valider" };

export default async function AdminReviewsPage() {
  const result = await serverApi<unknown>(
    "/api/admin/reviews?status=PENDING_REVIEW&limit=50&offset=0",
  );
  const reviews = unwrapList<ReviewDto>(result.data, ["reviews"]);
  return (
    <>
      <header className="page-header page-header--compact">
        <div className="page-header__copy">
          <p className="eyebrow">Modération communautaire</p>
          <h1 className="page-title">Avis à valider</h1>
          <p>Vérifie la pertinence et la conformité des évaluations avant publication.</p>
        </div>
      </header>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/admin/avis" />
      ) : reviews.length === 0 ? (
        <EmptyState title="Aucun avis en attente" description="La file de validation est à jour." />
      ) : (
        <div className="admin-list">
          {reviews.map((review) => (
            <article className="content-panel admin-list__item" key={String(review.id)}>
              <div className="admin-list__copy">
                <div className="button-row">
                  <StatusPill value={review.status} />
                  <strong>★ {review.overallRating}/10</strong>
                  <span>{formatDate(review.createdAt)}</span>
                </div>
                <h2>{review.entry?.name ?? review.entryName ?? "Fiche inconnue"}</h2>
                <p>{review.content}</p>
                {(review.entry?.slug ?? review.entryId) && (
                  <Link
                    className="text-link"
                    href={`/fiches/${encodeURIComponent(String(review.entry?.slug ?? review.entryId))}`}
                  >
                    Voir la fiche <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
              <AdminModerationActions
                endpoint={`/api/admin/reviews/${encodeURIComponent(String(review.id))}`}
                reasonRequired
                actions={[
                  {
                    status: "CHANGES_REQUESTED",
                    label: "Demander une correction",
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
