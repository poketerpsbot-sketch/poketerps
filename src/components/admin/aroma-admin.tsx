"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { submitJson } from "@/components/forms/form-api";

export type AdminAromaFamily = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

export type AdminAroma = {
  id: string;
  familyId: string;
  slug: string;
  name: string;
  description?: string | null;
  synonyms: string[];
  translations: Record<string, string>;
  sortOrder: number;
  isActive: boolean;
};

function payload(data: FormData) {
  const french = String(data.get("translationFr") ?? "").trim();
  const english = String(data.get("translationEn") ?? "").trim();
  return {
    familyId: String(data.get("familyId") ?? ""),
    name: String(data.get("name") ?? "").trim(),
    slug: String(data.get("slug") ?? "").trim() || undefined,
    description: String(data.get("description") ?? "").trim() || null,
    synonyms: String(data.get("synonyms") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    translations: {
      ...(french ? { fr: french } : {}),
      ...(english ? { en: english } : {}),
    },
    sortOrder: Number(data.get("sortOrder") ?? 0),
    isActive: data.get("isActive") === "on",
  };
}

function AromaFields({ families, aroma }: { families: AdminAromaFamily[]; aroma?: AdminAroma }) {
  return (
    <div className="form-grid">
      <div className="field">
        <label>Nom affiché</label>
        <input name="name" required maxLength={120} defaultValue={aroma?.name} />
      </div>
      <div className="field">
        <label>Famille</label>
        <select name="familyId" required defaultValue={aroma?.familyId ?? families[0]?.id}>
          {families
            .filter((family) => family.isActive)
            .map((family) => (
              <option value={family.id} key={family.id}>
                {family.name}
              </option>
            ))}
        </select>
      </div>
      <div className="field">
        <label>Slug</label>
        <input name="slug" maxLength={140} defaultValue={aroma?.slug} placeholder="automatique" />
      </div>
      <div className="field">
        <label>Ordre</label>
        <input name="sortOrder" type="number" defaultValue={aroma?.sortOrder ?? 0} />
      </div>
      <div className="field field--wide">
        <label>Synonymes (séparés par des virgules)</label>
        <input name="synonyms" defaultValue={aroma?.synonyms.join(", ")} />
      </div>
      <div className="field">
        <label>Traduction française</label>
        <input name="translationFr" maxLength={120} defaultValue={aroma?.translations.fr} />
      </div>
      <div className="field">
        <label>Traduction anglaise</label>
        <input name="translationEn" maxLength={120} defaultValue={aroma?.translations.en} />
      </div>
      <div className="field field--wide">
        <label>Description</label>
        <textarea name="description" rows={2} defaultValue={aroma?.description ?? ""} />
      </div>
      <label className="check-row field--wide">
        <input name="isActive" type="checkbox" defaultChecked={aroma?.isActive ?? true} />
        Actif et proposé dans les formulaires
      </label>
    </div>
  );
}

export function AromaAdmin({
  families,
  aromas,
}: {
  families: AdminAromaFamily[];
  aromas: AdminAroma[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit(endpoint: string, method: "POST" | "PATCH", data: FormData) {
    setPending(endpoint);
    setFeedback(null);
    const result = await submitJson(endpoint, method, payload(data));
    setPending(null);
    setFeedback(result.message);
    if (result.ok) router.refresh();
  }

  return (
    <div className="page-stack">
      {feedback && (
        <div className="form-feedback" role="status">
          {feedback}
        </div>
      )}
      <section className="content-panel section-stack">
        <div>
          <p className="eyebrow">Taxonomie sensorielle</p>
          <h2>Ajouter un arôme</h2>
        </div>
        <form
          action={(data) => void submit("/api/admin/aromas", "POST", data)}
          className="form-stack"
        >
          <AromaFields families={families} />
          <button
            className="button"
            type="submit"
            disabled={pending !== null || families.length === 0}
          >
            {pending === "/api/admin/aromas" ? "Création…" : "Créer l’arôme"}
          </button>
        </form>
      </section>
      <section className="content-panel section-stack">
        <div>
          <p className="eyebrow">{aromas.length} arômes</p>
          <h2>Modifier la taxonomie</h2>
          <p>Change la famille, l’ordre, les synonymes, les traductions ou désactive une option.</p>
        </div>
        <div className="admin-editor-list">
          {aromas.map((aroma) => {
            const endpoint = `/api/admin/aromas/${encodeURIComponent(aroma.id)}`;
            return (
              <details key={aroma.id} className="admin-editor">
                <summary>
                  <strong>{aroma.name}</strong>
                  <span>
                    {families.find((family) => family.id === aroma.familyId)?.name ??
                      "Famille inconnue"}
                  </span>
                  <span>{aroma.isActive ? "Actif" : "Désactivé"}</span>
                </summary>
                <form
                  action={(data) => void submit(endpoint, "PATCH", data)}
                  className="form-stack"
                >
                  <AromaFields families={families} aroma={aroma} />
                  <button className="button" type="submit" disabled={pending !== null}>
                    {pending === endpoint ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </form>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
