"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ImagePlus, Send } from "lucide-react";
import { submitJson, uploadImage, validateImage } from "@/components/forms/form-api";

const schema = z.object({
  type: z.enum(["IMPROVEMENT", "BUG", "REPORT", "OTHER"]),
  subject: z.string().trim().min(3, "Précise le sujet.").max(180),
  content: z.string().trim().min(10, "Décris ta demande en au moins 10 caractères.").max(10_000),
  pageUrl: z
    .union([
      z.literal(""),
      z.url("Indique une adresse complète commençant par https://.").max(2_000),
    ])
    .optional(),
  issueKind: z.string().trim().max(100).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  allowContact: z.boolean(),
});

type Values = z.infer<typeof schema>;
type CreatedMessage = { id?: string | number };

export function ContactForm() {
  const [attachment, setAttachment] = useState<File>();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { type: "IMPROVEMENT", priority: "NORMAL", allowContact: false },
  });
  const type = useWatch({ control, name: "type" });

  async function onSubmit(values: Values) {
    setFeedback(null);
    const imageError = validateImage(attachment, 5 * 1024 * 1024);
    if (imageError) {
      setFeedback({ type: "error", message: imageError });
      return;
    }
    const result = await submitJson<CreatedMessage>("/api/messages", "POST", {
      type: values.type,
      subject: values.subject,
      content: values.content,
      priority: values.priority,
      pageUrl: values.pageUrl || null,
      relatedEntryId: null,
      relatedReviewId: null,
      relatedPartnerId: null,
      allowContact: values.allowContact,
      metadata: values.issueKind ? { issueKind: values.issueKind } : {},
      attachmentPaths: [],
    });
    if (!result.ok) {
      setFeedback({ type: "error", message: result.message });
      return;
    }
    const messageId = result.data?.id;
    if (attachment && !messageId) {
      setFeedback({
        type: "success",
        message:
          "Le message est transmis, mais la réponse ne permet pas d’associer la capture d’écran.",
      });
      reset();
      setAttachment(undefined);
      return;
    }
    if (attachment && messageId) {
      try {
        await uploadImage(attachment, "message-attachments", String(messageId));
      } catch (error) {
        setFeedback({
          type: "success",
          message: `Le message est transmis, mais la capture n’a pas pu être jointe : ${error instanceof Error ? error.message : "fichier refusé"}`,
        });
        reset();
        setAttachment(undefined);
        return;
      }
    }
    setFeedback({ type: "success", message: "Ton message a bien été transmis à l’équipe." });
    reset();
    setAttachment(undefined);
  }

  return (
    <form className="form-panel form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="contact-type">Type de demande</label>
          <select id="contact-type" {...register("type")}>
            <option value="IMPROVEMENT">Proposer une amélioration</option>
            <option value="BUG">Signaler un problème</option>
            <option value="REPORT">Signaler un contenu</option>
            <option value="OTHER">Autre demande</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="contact-priority">Priorité indicative</label>
          <select id="contact-priority" {...register("priority")}>
            <option value="LOW">Faible</option>
            <option value="NORMAL">Normale</option>
            <option value="HIGH">Élevée</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        {type !== "IMPROVEMENT" && (
          <div className="field field--wide">
            <label htmlFor="contact-kind">Élément concerné</label>
            <select id="contact-kind" {...register("issueKind")}>
              <option value="">Choisir</option>
              <option value="Bug">Bug</option>
              <option value="Affichage">Affichage</option>
              <option value="Fiche incorrecte">Fiche incorrecte</option>
              <option value="Utilisateur">Utilisateur</option>
              <option value="Avis">Avis</option>
              <option value="Image">Image</option>
              <option value="Partenaire">Partenaire</option>
              <option value="Navigation">Navigation</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
        )}
        <div className="field field--wide">
          <label htmlFor="contact-subject">Sujet</label>
          <input
            id="contact-subject"
            {...register("subject")}
            aria-invalid={Boolean(errors.subject)}
          />
          {errors.subject && <p className="field__error">{errors.subject.message}</p>}
        </div>
        <div className="field field--wide">
          <label htmlFor="contact-content">Message</label>
          <textarea
            id="contact-content"
            rows={9}
            {...register("content")}
            aria-invalid={Boolean(errors.content)}
          />
          {errors.content && <p className="field__error">{errors.content.message}</p>}
        </div>
        <div className="field field--wide">
          <label htmlFor="contact-page">Page concernée (facultatif)</label>
          <input id="contact-page" type="url" placeholder="https://…" {...register("pageUrl")} />
          {errors.pageUrl && <p className="field__error">{errors.pageUrl.message}</p>}
        </div>
        <div className="field field--wide">
          <label htmlFor="contact-image">
            <ImagePlus size={17} aria-hidden="true" /> Capture d’écran (facultative)
          </label>
          <input
            id="contact-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => setAttachment(event.target.files?.[0])}
          />
          <p className="field__hint">Image uniquement, 5 Mo maximum.</p>
        </div>
      </div>
      <label className="checkbox-field">
        <input type="checkbox" {...register("allowContact")} />
        <span>
          J’autorise l’équipe à me recontacter via le bot Telegram à propos de cette demande.
        </span>
      </label>
      {feedback && (
        <div
          className={`form-feedback${feedback.type === "error" ? " form-feedback--error" : ""}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      )}
      <button className="button" type="submit" disabled={isSubmitting}>
        <Send size={17} aria-hidden="true" />{" "}
        {isSubmitting ? "Transmission…" : "Transmettre à l’équipe"}
      </button>
    </form>
  );
}
