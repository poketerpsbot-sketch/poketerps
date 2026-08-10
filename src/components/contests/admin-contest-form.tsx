"use client";

import { useId, useState } from "react";
import { CalendarClock, Save, Sparkles } from "lucide-react";

import type {
  ContestFormValue,
  ContestScoringMode,
  ContestStatus,
} from "@/components/contests/types";
import { localDateTime } from "@/components/contests/contest-utils";

const statuses: Array<{ value: ContestStatus; label: string }> = [
  { value: "DRAFT", label: "Brouillon (invisible)" },
  { value: "SCHEDULED", label: "Programmé" },
  { value: "ACTIVE", label: "Actif" },
  { value: "PAUSED", label: "En pause" },
  { value: "ENDED", label: "Terminé" },
  { value: "CANCELLED", label: "Annulé" },
];

const scoringModes: Array<{ value: ContestScoringMode; label: string }> = [
  { value: "MANUAL", label: "Note manuelle de l’équipe" },
  { value: "ENTRY_LIKES", label: "J’aime de la fiche" },
  { value: "ENTRY_VIEWS", label: "Vues de la fiche" },
  { value: "ENTRY_FAVORITES", label: "Favoris de la fiche" },
  { value: "ENTRY_RATING", label: "Note moyenne de la fiche" },
  { value: "COMPOSITE", label: "Score combiné" },
];

function isoFromLocal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString();
}

function defaultValue(): ContestFormValue {
  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endsAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  return {
    slug: "",
    title: "",
    summary: "",
    description: "",
    rules: "",
    imageUrl: null,
    status: "DRAFT",
    isFeatured: false,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    scoringMode: "MANUAL",
    criteria: {},
    reward: { title: "Mise à l’honneur dans la communauté" },
    rewardBadgeId: null,
    maxParticipants: null,
    requireEntry: true,
  };
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

export function AdminContestForm({
  initialValue,
  submitLabel = "Créer le concours",
  pending = false,
  onSubmit,
}: {
  initialValue?: ContestFormValue;
  submitLabel?: string;
  pending?: boolean;
  onSubmit: (value: ContestFormValue) => Promise<void> | void;
}) {
  const baseId = useId();
  const [value, setValue] = useState(initialValue ?? defaultValue());
  const [criteriaJson, setCriteriaJson] = useState(JSON.stringify(value.criteria, null, 2));
  const [rewardJson, setRewardJson] = useState(JSON.stringify(value.reward, null, 2));
  const [error, setError] = useState("");

  const field = <K extends keyof ContestFormValue>(key: K, next: ContestFormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let criteria: Record<string, unknown>;
    let reward: Record<string, unknown>;
    try {
      criteria = JSON.parse(criteriaJson) as Record<string, unknown>;
      reward = JSON.parse(rewardJson) as Record<string, unknown>;
      if (!criteria || Array.isArray(criteria) || typeof criteria !== "object") throw new Error();
      if (!reward || Array.isArray(reward) || typeof reward !== "object") throw new Error();
    } catch {
      setError("Les critères et la récompense doivent être des objets JSON valides.");
      return;
    }
    if (new Date(value.endsAt) <= new Date(value.startsAt)) {
      setError("La date de fin doit être postérieure à la date de début.");
      return;
    }
    void onSubmit({
      ...value,
      imageUrl: value.imageUrl?.trim() || null,
      rewardBadgeId: value.rewardBadgeId?.trim() || null,
      criteria,
      reward,
    });
  }

  return (
    <form className="admin-contest-form" onSubmit={submit}>
      <div className="admin-contest-form__section">
        <header>
          <Sparkles aria-hidden="true" />
          <div>
            <h3>Présentation</h3>
            <p>Ce que les membres verront dans l’onglet Concours.</p>
          </div>
        </header>
        <div className="form-grid">
          <div className="field field--wide">
            <label htmlFor={`${baseId}-title`}>Titre</label>
            <input
              id={`${baseId}-title`}
              required
              minLength={2}
              maxLength={180}
              value={value.title}
              onChange={(event) => {
                field("title", event.target.value);
                if (!initialValue && !value.slug) field("slug", slugify(event.target.value));
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-slug`}>Adresse courte</label>
            <input
              id={`${baseId}-slug`}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={value.slug}
              onChange={(event) => field("slug", slugify(event.target.value))}
            />
            <small>Ex. meilleure-fleur-aout</small>
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-image`}>Image HTTPS (facultative)</label>
            <input
              id={`${baseId}-image`}
              type="url"
              value={value.imageUrl ?? ""}
              placeholder="https://…"
              onChange={(event) => field("imageUrl", event.target.value)}
            />
          </div>
          <div className="field field--wide">
            <label htmlFor={`${baseId}-summary`}>Résumé de la carte</label>
            <textarea
              id={`${baseId}-summary`}
              required
              minLength={2}
              maxLength={320}
              value={value.summary}
              onChange={(event) => field("summary", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-description`}>Description complète</label>
            <textarea
              id={`${baseId}-description`}
              required
              minLength={2}
              maxLength={20000}
              value={value.description}
              onChange={(event) => field("description", event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-rules`}>Règlement</label>
            <textarea
              id={`${baseId}-rules`}
              required
              minLength={2}
              maxLength={20000}
              value={value.rules}
              onChange={(event) => field("rules", event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="admin-contest-form__section">
        <header>
          <CalendarClock aria-hidden="true" />
          <div>
            <h3>Programmation et classement</h3>
            <p>Dates, visibilité et méthode de calcul.</p>
          </div>
        </header>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${baseId}-starts`}>Début</label>
            <input
              id={`${baseId}-starts`}
              type="datetime-local"
              required
              value={localDateTime(value.startsAt)}
              onChange={(event) => field("startsAt", isoFromLocal(event.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-ends`}>Fin</label>
            <input
              id={`${baseId}-ends`}
              type="datetime-local"
              required
              value={localDateTime(value.endsAt)}
              onChange={(event) => field("endsAt", isoFromLocal(event.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-status`}>Statut</label>
            <select
              id={`${baseId}-status`}
              value={value.status}
              onChange={(event) => field("status", event.target.value as ContestStatus)}
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-scoring`}>Classement</label>
            <select
              id={`${baseId}-scoring`}
              value={value.scoringMode}
              onChange={(event) => field("scoringMode", event.target.value as ContestScoringMode)}
            >
              {scoringModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-maximum`}>Nombre maximal de participants</label>
            <input
              id={`${baseId}-maximum`}
              type="number"
              min={1}
              max={1000000}
              value={value.maxParticipants ?? ""}
              placeholder="Sans limite"
              onChange={(event) =>
                field("maxParticipants", event.target.value ? Number(event.target.value) : null)
              }
            />
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-badge`}>ID du badge récompense (facultatif)</label>
            <input
              id={`${baseId}-badge`}
              value={value.rewardBadgeId ?? ""}
              placeholder="UUID du badge"
              onChange={(event) => field("rewardBadgeId", event.target.value)}
            />
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={value.requireEntry}
              onChange={(event) => field("requireEntry", event.target.checked)}
            />
            <span>Exiger une fiche personnelle publiée</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={value.isFeatured}
              onChange={(event) => field("isFeatured", event.target.checked)}
            />
            <span>Mettre le concours à la une</span>
          </label>
          <div className="field">
            <label htmlFor={`${baseId}-criteria`}>Critères (JSON)</label>
            <textarea
              id={`${baseId}-criteria`}
              className="code-input"
              value={criteriaJson}
              onChange={(event) => setCriteriaJson(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${baseId}-reward`}>Récompense (JSON)</label>
            <textarea
              id={`${baseId}-reward`}
              className="code-input"
              value={rewardJson}
              onChange={(event) => setRewardJson(event.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="admin-action-feedback" role="alert">
          {error}
        </p>
      )}
      <button className="button button--dark" type="submit" disabled={pending}>
        <Save aria-hidden="true" /> {pending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
