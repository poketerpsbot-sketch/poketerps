import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { ReviewDto } from "@/components/data/types";
import { EmptyState, ErrorState, StatusPill, formatDate } from "@/components/ui/states";
import { reviewPresentation } from "@/lib/reviews/presentation";

export const metadata: Metadata = { title: "Mes avis" };

export default async function MyReviewsPage() {
  const result = await serverApi<unknown>("/api/me");
  const reviews = unwrapList<ReviewDto>(result.data, ["reviews"]);
  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Historique personnel</p>
          <h1 className="page-title">Mes avis</h1>
          <p>Les avis en attente restent privés jusqu’à leur validation.</p>
        </div>
        <MessageSquare className="page-header__mark" size={58} aria-hidden="true" />
      </header>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/profil/avis" />
      ) : reviews.length === 0 ? (
        <EmptyState
          title="Aucun avis envoyé"
          description="Ouvre une capture pour déposer une évaluation soumise à validation."
          action={{ href: "/explorer", label: "Trouver une capture" }}
        />
      ) : (
        <div className="list-stack">
          {reviews.map((review) => {
            const presentation = reviewPresentation(review.status);
            return (
              <article
                className={`list-row my-review-card my-review-card--${presentation.tone}`}
                key={String(review.id)}
              >
                <span className="category-card__icon" aria-hidden="true">
                  ★
                </span>
                <div className="list-row__copy">
                  <h3>{review.entry?.name ?? review.entryName ?? "Avis"}</h3>
                  <strong className="my-review-card__status">{presentation.label}</strong>
                  <p>{presentation.description}</p>
                  <p>{review.content}</p>
                  {review.moderationReason && (
                    <p>
                      <strong>Retour de la modération :</strong> {review.moderationReason}
                    </p>
                  )}
                  {review.status === "CHANGES_REQUESTED" && (
                    <Link
                      className="button"
                      href={`/profil/avis/${encodeURIComponent(String(review.id))}`}
                    >
                      Modifier mon avis
                    </Link>
                  )}
                  <p>{formatDate(review.createdAt)}</p>
                </div>
                <div className="list-row__meta">
                  ★{" "}
                  {Number(review.overallRating).toLocaleString("fr-CH", {
                    maximumFractionDigits: 1,
                  })}
                  <br />
                  <StatusPill value={review.status} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
