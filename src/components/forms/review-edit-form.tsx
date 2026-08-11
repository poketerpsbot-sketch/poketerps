"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw, Star } from "lucide-react";

import type { ReviewDto } from "@/components/data/types";
import { submitJson } from "@/components/forms/form-api";

type EditableReview = ReviewDto & { canEdit: boolean };

export function ReviewEditForm({ review }: { review: EditableReview }) {
  const router = useRouter();
  const [content, setContent] = useState(review.content);
  const [overallRating, setOverallRating] = useState(Number(review.overallRating));
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (review.ratings ?? []).map((rating) => [String(rating.criterionId), Number(rating.score)]),
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedContent = content.trim();
    if (normalizedContent.length < 10) {
      setFeedback("Décris ton expérience en au moins 10 caractères.");
      return;
    }
    if (!Number.isFinite(overallRating) || overallRating < 0 || overallRating > 10) {
      setFeedback("La note doit être comprise entre 0 et 10.");
      return;
    }
    setIsSubmitting(true);
    setFeedback("");
    const result = await submitJson(
      `/api/me/reviews/${encodeURIComponent(String(review.id))}`,
      "PATCH",
      {
        content: normalizedContent,
        overallRating,
        ratings: (review.ratings ?? []).map((rating) => ({
          criterionId: String(rating.criterionId),
          score: scores[String(rating.criterionId)] ?? Number(rating.score),
        })),
      },
    );
    setIsSubmitting(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    router.push("/profil/avis");
    router.refresh();
  }

  return (
    <form className="form-panel form-stack review-edit-form" onSubmit={submit} noValidate>
      <aside className="review-change-request" aria-labelledby="review-change-request-title">
        <AlertCircle aria-hidden="true" />
        <div>
          <p className="eyebrow">Modification demandée par l’équipe</p>
          <h2 id="review-change-request-title">Retour de la modération</h2>
          <p>{review.moderationReason ?? "L’équipe te demande de compléter cet avis."}</p>
        </div>
      </aside>

      <div className="field">
        <label htmlFor="review-edit-rating">
          <Star size={16} aria-hidden="true" /> Note sur 10
        </label>
        <input
          id="review-edit-rating"
          type="number"
          min="0"
          max="10"
          step="0.5"
          inputMode="decimal"
          value={overallRating}
          onChange={(event) => setOverallRating(event.currentTarget.valueAsNumber)}
          required
        />
      </div>

      {(review.ratings ?? []).length > 0 && (
        <fieldset className="review-criteria">
          <legend>Critères détaillés</legend>
          {(review.ratings ?? []).map((rating) => {
            const id = `review-criterion-${String(rating.criterionId)}`;
            return (
              <div className="field" key={String(rating.criterionId)}>
                <label htmlFor={id}>{rating.label}</label>
                <input
                  id={id}
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  inputMode="decimal"
                  value={scores[String(rating.criterionId)] ?? Number(rating.score)}
                  onChange={(event) =>
                    setScores((current) => ({
                      ...current,
                      [String(rating.criterionId)]: event.currentTarget.valueAsNumber,
                    }))
                  }
                  required
                />
              </div>
            );
          })}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="review-edit-content">Ton avis corrigé</label>
        <textarea
          id="review-edit-content"
          rows={10}
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          maxLength={5_000}
          required
        />
        <p className="field__hint">
          La nouvelle version retournera en validation et ne sera pas republiée automatiquement.
        </p>
      </div>

      {feedback && (
        <p className="form-feedback form-feedback--error" role="alert">
          {feedback}
        </p>
      )}
      <button className="button" type="submit" disabled={isSubmitting || !review.canEdit}>
        <RotateCcw size={17} aria-hidden="true" />
        {isSubmitting ? "Renvoi…" : "Renvoyer pour validation"}
      </button>
    </form>
  );
}
