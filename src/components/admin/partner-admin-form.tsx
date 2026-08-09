"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

export function PartnerAdminForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    const result = await submitJson("/api/admin/partners", "POST", {
      name: String(data.get("name") ?? ""),
      description: String(data.get("description") ?? "") || null,
      websiteUrl: String(data.get("websiteUrl") ?? "") || null,
      telegramUrl: String(data.get("telegramUrl") ?? "") || null,
      instagramUrl: String(data.get("instagramUrl") ?? "") || null,
      otherUrl: null,
      categoryId: null,
      logoPath: null,
      coverPath: null,
      isActive: true,
      isFeatured: data.get("isFeatured") === "on",
      sortOrder: 0,
    });
    setPending(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    event.currentTarget.reset();
    setFeedback("Partenaire créé.");
    router.refresh();
  }

  return (
    <form className="form-panel form-stack" onSubmit={submit}>
      <h2>Ajouter un partenaire</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="partner-name">Nom</label>
          <input id="partner-name" name="name" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="partner-website">Site</label>
          <input id="partner-website" name="websiteUrl" type="url" />
        </div>
        <div className="field">
          <label htmlFor="partner-telegram">Telegram</label>
          <input id="partner-telegram" name="telegramUrl" type="url" />
        </div>
        <div className="field">
          <label htmlFor="partner-instagram">Instagram</label>
          <input id="partner-instagram" name="instagramUrl" type="url" />
        </div>
        <div className="field field--wide">
          <label htmlFor="partner-description">Description</label>
          <textarea id="partner-description" name="description" rows={5} />
        </div>
      </div>
      <label className="checkbox-field">
        <input type="checkbox" name="isFeatured" />
        <span>Mettre à la une immédiatement</span>
      </label>
      {feedback && (
        <div className="form-feedback" aria-live="polite">
          {feedback}
        </div>
      )}
      <button className="button" type="submit" disabled={pending}>
        <Plus size={16} aria-hidden="true" /> {pending ? "Création…" : "Créer le partenaire"}
      </button>
    </form>
  );
}
