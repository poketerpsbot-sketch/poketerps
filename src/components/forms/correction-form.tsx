"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Send } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

const schema = z.object({
  summary: z
    .string()
    .trim()
    .min(10, "Explique brièvement pourquoi cette correction est utile.")
    .max(2_000),
  fieldPath: z.enum([
    "name",
    "shortDescription",
    "fullDescription",
    "category",
    "subcategory",
    "micron",
    "fields",
    "images",
    "other",
  ]),
  proposedValue: z.string().trim().min(2, "Décris la modification proposée.").max(8_000),
});

type Values = z.infer<typeof schema>;

export function CorrectionForm({ entryId, entrySlug }: { entryId: string; entrySlug: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fieldPath: "other" } });

  async function onSubmit(values: Values) {
    setFeedback(null);
    const result = await submitJson("/api/submissions", "POST", {
      entryId,
      summary: values.summary,
      changes: [{ fieldPath: values.fieldPath, proposedValue: values.proposedValue }],
    });
    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }
    setFeedback({ type: "success", message: "Correction transmise à l’équipe." });
    router.push(`/fiches/${encodeURIComponent(entrySlug)}`);
    router.refresh();
  }

  return (
    <form className="form-panel form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="field">
        <label htmlFor="correction-summary">Résumé</label>
        <textarea
          id="correction-summary"
          rows={4}
          {...register("summary")}
          aria-invalid={Boolean(errors.summary)}
        />
        {errors.summary && <p className="field__error">{errors.summary.message}</p>}
      </div>
      <div className="field">
        <label htmlFor="correction-field">Élément concerné</label>
        <select id="correction-field" {...register("fieldPath")}>
          <option value="name">Nom</option>
          <option value="shortDescription">Résumé de la fiche</option>
          <option value="fullDescription">Description complète</option>
          <option value="category">Catégorie</option>
          <option value="subcategory">Sous-catégorie</option>
          <option value="micron">Microns</option>
          <option value="fields">Caractéristique</option>
          <option value="images">Image</option>
          <option value="other">Autre</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="correction-value">Modification proposée</label>
        <textarea
          id="correction-value"
          rows={9}
          {...register("proposedValue")}
          aria-invalid={Boolean(errors.proposedValue)}
        />
        {errors.proposedValue && <p className="field__error">{errors.proposedValue.message}</p>}
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
        <Send size={17} aria-hidden="true" /> {isSubmitting ? "Envoi…" : "Envoyer la correction"}
      </button>
    </form>
  );
}
