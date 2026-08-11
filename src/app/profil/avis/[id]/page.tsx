import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilePenLine } from "lucide-react";

import type { ReviewDto } from "@/components/data/types";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { ReviewEditForm } from "@/components/forms/review-edit-form";
import { ErrorState } from "@/components/ui/states";

type Props = { params: Promise<{ id: string }> };
type EditableReview = ReviewDto & { canEdit: boolean };

export const metadata: Metadata = { title: "Modifier mon avis" };

export default async function EditReviewPage({ params }: Props) {
  const { id } = await params;
  const result = await serverApi<unknown>(`/api/me/reviews/${encodeURIComponent(id)}`);
  if (result.status === 404) notFound();
  const review = unwrapObject<EditableReview>(result.data);

  return (
    <div className="page-shell page-shell--narrow page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Nouvelle version</p>
          <h1 className="page-title">Modifier mon avis</h1>
          <p>
            Corrige ton avis sur « {review?.entryName ?? "cette fiche"} », puis renvoie-le à
            l’équipe.
          </p>
        </div>
        <FilePenLine className="page-header__mark" size={58} aria-hidden="true" />
      </header>

      {result.error || !review ? (
        <ErrorState
          message={result.error ?? "Cet avis est introuvable."}
          retryHref="/profil/avis"
        />
      ) : !review.canEdit ? (
        <ErrorState
          message="Aucune modification n’est actuellement demandée pour cet avis."
          retryHref="/profil/avis"
        />
      ) : (
        <ReviewEditForm review={review} />
      )}
    </div>
  );
}
