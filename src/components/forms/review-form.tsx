"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Send, Star } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

const schema = z.object({
  content: z.string().trim().min(10, "Décris ton expérience en au moins 10 caractères.").max(5_000),
  overallRating: z.number().min(0).max(10),
});

type Values = z.infer<typeof schema>;

export function ReviewForm({ entryId, entrySlug }: { entryId: string; entrySlug: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { content: "", overallRating: 8 },
  });

  async function onSubmit(values: Values) {
    setFeedback(null);
    const result = await submitJson(`/api/entries/${encodeURIComponent(entryId)}/reviews`, "POST", {
      content: values.content,
      overallRating: values.overallRating,
      ratings: [],
    });
    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }
    setFeedback({ type: "success", message: "Avis transmis à la modération." });
    router.push(`/fiches/${encodeURIComponent(entrySlug)}`);
    router.refresh();
  }

  return (
    <form className="form-panel form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="field">
        <label htmlFor="review-rating">
          <Star size={16} aria-hidden="true" /> Note sur 10
        </label>
        <input
          id="review-rating"
          type="number"
          min="0"
          max="10"
          step="0.5"
          inputMode="decimal"
          {...register("overallRating", { valueAsNumber: true })}
          aria-invalid={Boolean(errors.overallRating)}
          aria-describedby={errors.overallRating ? "review-rating-error" : undefined}
        />
        {errors.overallRating && (
          <p className="field__error" id="review-rating-error">
            {errors.overallRating.message}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="review-content">Ton avis</label>
        <textarea
          id="review-content"
          rows={9}
          {...register("content")}
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? "review-content-error" : "review-content-hint"}
        />
        <p className="field__hint" id="review-content-hint">
          Reste factuel, respectueux et n’inclus aucune proposition commerciale.
        </p>
        {errors.content && (
          <p className="field__error" id="review-content-error">
            {errors.content.message}
          </p>
        )}
      </div>
      {feedback && (
        <div
          className={`form-feedback${feedback.type === "error" ? " form-feedback--error" : ""}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      )}
      <button className="button" type="submit" disabled={isSubmitting}>
        <Send size={17} aria-hidden="true" /> {isSubmitting ? "Envoi…" : "Envoyer pour validation"}
      </button>
    </form>
  );
}
