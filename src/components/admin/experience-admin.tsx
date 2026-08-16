"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Power, Save } from "lucide-react";

import { submitJson } from "@/components/forms/form-api";

export type ExperienceRuleAdmin = {
  key: string;
  label: string;
  points: number;
  description?: string | null;
  isActive: boolean;
};

export type LevelDefinitionAdmin = {
  level: number;
  threshold: number;
  title: string;
  isActive: boolean;
};

export function ExperienceAdmin({
  rules,
  levels,
}: {
  rules: ExperienceRuleAdmin[];
  levels: LevelDefinitionAdmin[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");

  async function saveRule(event: FormEvent<HTMLFormElement>, rule: ExperienceRuleAdmin) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const endpoint = `/api/admin/experience/rules/${encodeURIComponent(rule.key)}`;
    setPending(endpoint);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", {
      label: String(data.get("label") ?? ""),
      points: Number(data.get("points") ?? 0),
      description: String(data.get("description") ?? "") || null,
      isActive: data.get("isActive") === "on",
    });
    setPending("");
    setFeedback(result.ok ? "Règle XP enregistrée." : result.message);
    if (result.ok) router.refresh();
  }

  async function saveLevel(event: FormEvent<HTMLFormElement>, level: LevelDefinitionAdmin) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const endpoint = `/api/admin/experience/levels/${level.level}`;
    setPending(endpoint);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", {
      title: String(data.get("title") ?? ""),
      threshold: Number(data.get("threshold") ?? 0),
      isActive: data.get("isActive") === "on",
    });
    setPending("");
    setFeedback(result.ok ? `Niveau ${level.level} enregistré.` : result.message);
    if (result.ok) router.refresh();
  }

  return (
    <div className="page-stack">
      <section className="content-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Attribution automatique</p>
            <h2>Règles XP</h2>
          </div>
          <p>
            Chaque événement reste idempotent : modifier les points ne les distribue pas deux fois.
          </p>
        </div>
        <div className="admin-card-grid admin-card-grid--compact">
          {rules.map((rule) => {
            const endpoint = `/api/admin/experience/rules/${encodeURIComponent(rule.key)}`;
            return (
              <form
                className="content-panel form-stack"
                key={rule.key}
                onSubmit={(event) => saveRule(event, rule)}
              >
                <p className="eyebrow">{rule.key}</p>
                <div className="field">
                  <label htmlFor={`rule-label-${rule.key}`}>Nom</label>
                  <input
                    id={`rule-label-${rule.key}`}
                    name="label"
                    defaultValue={rule.label}
                    required
                    maxLength={120}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`rule-points-${rule.key}`}>XP accordée</label>
                  <input
                    id={`rule-points-${rule.key}`}
                    name="points"
                    type="number"
                    min={0}
                    max={10_000}
                    defaultValue={rule.points}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`rule-description-${rule.key}`}>Description</label>
                  <textarea
                    id={`rule-description-${rule.key}`}
                    name="description"
                    rows={2}
                    defaultValue={rule.description ?? ""}
                    maxLength={1_500}
                  />
                </div>
                <label className="admin-check-row">
                  <input name="isActive" type="checkbox" defaultChecked={rule.isActive} />
                  <Power size={15} aria-hidden="true" /> Règle active
                </label>
                <button className="button" type="submit" disabled={pending === endpoint}>
                  <Save size={15} aria-hidden="true" />{" "}
                  {pending === endpoint ? "Enregistrement…" : "Enregistrer"}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="content-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Progression PokéTerps</p>
            <h2>Niveaux</h2>
          </div>
          <p>Les seuils doivent rester uniques et croissants pour une progression lisible.</p>
        </div>
        <div className="admin-level-grid">
          {levels.map((level) => {
            const endpoint = `/api/admin/experience/levels/${level.level}`;
            return (
              <form
                className="admin-level-row"
                key={level.level}
                onSubmit={(event) => saveLevel(event, level)}
              >
                <strong>Niv. {level.level}</strong>
                <label>
                  <span className="sr-only">Titre du niveau {level.level}</span>
                  <input name="title" defaultValue={level.title} required maxLength={120} />
                </label>
                <label>
                  <span className="sr-only">Seuil XP du niveau {level.level}</span>
                  <input
                    name="threshold"
                    type="number"
                    min={0}
                    defaultValue={level.threshold}
                    required
                  />
                </label>
                <label className="admin-check-row">
                  <input name="isActive" type="checkbox" defaultChecked={level.isActive} /> Actif
                </label>
                <button
                  className="button button--secondary"
                  type="submit"
                  disabled={pending === endpoint}
                >
                  <Save size={15} aria-hidden="true" />
                  <span className="sr-only">Enregistrer le niveau {level.level}</span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {feedback && (
        <p className="admin-action-feedback" aria-live="polite">
          {feedback}
        </p>
      )}
    </div>
  );
}
