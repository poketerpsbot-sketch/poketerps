"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Send, X } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

export type PublicationTarget = { id: string | number; name: string };

export type AdminPublication = {
  id: string | number;
  type: "ENTRY" | "PARTNER" | "ANNOUNCEMENT" | string;
  status: string;
  entryId?: string | number | null;
  entryName?: string | null;
  partnerId?: string | number | null;
  partnerName?: string | null;
  previewPayload?: Record<string, unknown> | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  lastError?: string | null;
  attemptCount?: number | null;
  createdAt?: string | null;
};

export function PublicationComposer({
  entries,
  partners,
}: {
  entries: PublicationTarget[];
  partners: PublicationTarget[];
}) {
  const router = useRouter();
  const [type, setType] = useState("ENTRY");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const schedule = String(data.get("scheduledAt") ?? "");
    setPending(true);
    setFeedback("");
    const result = await submitJson("/api/admin/publications", "POST", {
      type,
      entryId: type === "ENTRY" ? String(data.get("entryId") ?? "") : null,
      partnerId: type === "PARTNER" ? String(data.get("partnerId") ?? "") : null,
      text: type === "ANNOUNCEMENT" ? String(data.get("text") ?? "") : undefined,
      scheduledAt: schedule ? new Date(schedule).toISOString() : null,
    });
    setPending(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    form.reset();
    setType("ENTRY");
    setFeedback("Publication enregistrée. Utilise Prévisualiser avant l’envoi.");
    router.refresh();
  }

  return (
    <details className="content-panel admin-disclosure">
      <summary>Préparer une publication</summary>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="publication-type">Type</label>
            <select
              id="publication-type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="ENTRY">Fiche publiée</option>
              <option value="PARTNER">Partenaire</option>
              <option value="ANNOUNCEMENT">Annonce éditoriale</option>
            </select>
          </div>
          {type === "ENTRY" && (
            <div className="field">
              <label htmlFor="publication-entry">Fiche</label>
              <select id="publication-entry" name="entryId" required defaultValue="">
                <option value="" disabled>
                  Choisir une fiche
                </option>
                {entries.map((entry) => (
                  <option value={String(entry.id)} key={String(entry.id)}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {type === "PARTNER" && (
            <div className="field">
              <label htmlFor="publication-partner">Partenaire</label>
              <select id="publication-partner" name="partnerId" required defaultValue="">
                <option value="" disabled>
                  Choisir un partenaire
                </option>
                {partners.map((partner) => (
                  <option value={String(partner.id)} key={String(partner.id)}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="publication-schedule">Planifier (optionnel)</label>
            <input id="publication-schedule" name="scheduledAt" type="datetime-local" />
          </div>
        </div>
        {type === "ANNOUNCEMENT" && (
          <div className="field">
            <label htmlFor="publication-text">Texte</label>
            <textarea
              id="publication-text"
              name="text"
              rows={7}
              required
              minLength={1}
              maxLength={4_096}
            />
            <p className="field__hint">
              Le contenu est échappé côté serveur avant envoi à Telegram.
            </p>
          </div>
        )}
        {feedback && (
          <p className="admin-action-feedback" aria-live="polite">
            {feedback}
          </p>
        )}
        <button className="button" type="submit" disabled={pending}>
          <Plus size={16} aria-hidden="true" /> {pending ? "Enregistrement…" : "Créer le brouillon"}
        </button>
      </form>
    </details>
  );
}

export function PublicationActions({ publication }: { publication: AdminPublication }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const canProcess = ["DRAFT", "PREVIEWED", "SCHEDULED", "FAILED"].includes(publication.status);
  const canPreview = ["DRAFT", "PREVIEWED", "FAILED"].includes(publication.status);

  async function run(action: "preview" | "publish" | "cancel") {
    if (
      action !== "preview" &&
      !window.confirm(
        action === "publish"
          ? "Publier maintenant sur le canal Telegram ?"
          : "Annuler cette publication ?",
      )
    )
      return;
    setPending(action);
    setFeedback("");
    const result = await submitJson(
      `/api/admin/publications/${encodeURIComponent(String(publication.id))}`,
      "PATCH",
      { action },
    );
    setPending("");
    setFeedback(
      result.ok
        ? action === "preview"
          ? "Prévisualisation envoyée dans Telegram."
          : "Action enregistrée."
        : result.message,
    );
    if (result.ok) router.refresh();
  }

  if (!canProcess) {
    return publication.lastError ? (
      <p className="admin-action-feedback" role="alert">
        {publication.lastError}
      </p>
    ) : null;
  }

  return (
    <div className="admin-action-stack">
      <div className="button-row">
        {canPreview && (
          <button
            className="button button--secondary"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run("preview")}
          >
            <Eye size={15} aria-hidden="true" />{" "}
            {pending === "preview" ? "Préparation…" : "Prévisualiser"}
          </button>
        )}
        <button
          className="button"
          type="button"
          disabled={Boolean(pending)}
          onClick={() => run("publish")}
        >
          <Send size={15} aria-hidden="true" />{" "}
          {pending === "publish" ? "Publication…" : "Publier maintenant"}
        </button>
        <button
          className="button button--danger"
          type="button"
          disabled={Boolean(pending)}
          onClick={() => run("cancel")}
        >
          <X size={15} aria-hidden="true" /> {pending === "cancel" ? "Annulation…" : "Annuler"}
        </button>
      </div>
      {publication.lastError && (
        <p className="admin-action-feedback" role="alert">
          Dernière erreur : {publication.lastError}
        </p>
      )}
      {feedback && (
        <p className="admin-action-feedback" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  );
}
