import type { Metadata } from "next";
import Link from "next/link";
import { AdminModerationActions } from "@/components/admin/admin-actions";
import { ReviewHistory } from "@/components/admin/review-history";
import type { ReviewDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Avis à valider" };

function ReviewCard({ review, actions = false }: { review: ReviewDto; actions?: boolean }) {
  return (
    <article className="content-panel admin-list__item">
      <div className="admin-list__copy">
        <div className="button-row">
          <StatusPill value={review.status} />
          <strong>★ {review.overallRating}/10</strong>
          <span>{formatDate(review.createdAt)}</span>
        </div>
        <h2>{review.entry?.name ?? review.entryName ?? "Fiche inconnue"}</h2>
        <p>{review.content}</p>
        {review.moderationReason && (
          <p className="review-history__reason">
            <strong>Dernier message :</strong> {review.moderationReason}
          </p>
        )}
        {(review.entry?.slug ?? review.entryId) && (
          <Link
            className="text-link"
            href={`/fiches/${encodeURIComponent(String(review.entry?.slug ?? review.entryId))}`}
          >
            Voir la fiche <span aria-hidden="true">→</span>
          </Link>
        )}
        <ReviewHistory events={review.moderationHistory ?? []} />
      </div>
      {actions && (
        <AdminModerationActions
          endpoint={`/api/admin/reviews/${encodeURIComponent(String(review.id))}`}
          reasonRequired
          actions={[
            {
              status: "CHANGES_REQUESTED",
              label: "Demander une modification",
              tone: "secondary",
            },
            { status: "APPROVED", label: "Approuver" },
            { status: "REJECTED", label: "Refuser", tone: "danger" },
          ]}
        />
      )}
    </article>
  );
}

type Props = { searchParams: Promise<{ review?: string }> };

export default async function AdminReviewsPage({ searchParams }: Props) {
  const { review: focusedReviewId } = await searchParams;
  const [result, historyResult] = await Promise.all([
    serverApi<unknown>("/api/admin/reviews?status=PENDING_REVIEW&limit=50&offset=0"),
    serverApi<unknown>("/api/admin/reviews?limit=50&offset=0"),
  ]);
  const reviews = unwrapList<ReviewDto>(result.data, ["reviews"]).sort((left, right) => {
    if (String(left.id) === focusedReviewId) return -1;
    if (String(right.id) === focusedReviewId) return 1;
    return 0;
  });
  const history = unwrapList<ReviewDto>(historyResult.data, ["reviews"]).filter(
    (review) => review.status !== "PENDING_REVIEW",
  );
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
            <ReviewCard review={review} actions key={String(review.id)} />
          ))}
        </div>
      )}

      <section className="section-stack admin-review-history-list">
        <header>
          <p className="eyebrow">Traçabilité</p>
          <h2>Historique récent</h2>
          <p>Chaque décision et chaque resoumission restent visibles par l’équipe.</p>
        </header>
        {historyResult.error ? (
          <ErrorState message={historyResult.error} retryHref="/admin/avis" />
        ) : history.length === 0 ? (
          <EmptyState title="Aucun historique" description="Les décisions apparaîtront ici." />
        ) : (
          <div className="admin-list">
            {history.map((review) => (
              <ReviewCard review={review} key={String(review.id)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
