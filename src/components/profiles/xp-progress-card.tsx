"use client";

import { useRef } from "react";
import { Sparkles, X } from "lucide-react";

import type { ExperienceOverviewDto } from "@/components/data/types";
import { BASE_LEVELS, experienceProgress } from "@/lib/xp";

const DEFAULT_XP_RULES = [
  { key: "ENTRY_PUBLISHED", label: "Fiche publiée", points: 20 },
  { key: "REVIEW_PUBLISHED", label: "Avis publié", points: 8 },
  { key: "CONTEST_PARTICIPATION", label: "Participation à un concours", points: 3 },
  { key: "CONTEST_WIN", label: "Victoire de concours", points: 25 },
] as const;

export function XpProgressCard({
  experience,
  showHistory = false,
}: {
  experience: ExperienceOverviewDto;
  showHistory?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const suppliedPoints = Number(experience.progress?.experiencePoints ?? 0);
  const computedProgress = experienceProgress(Number.isFinite(suppliedPoints) ? suppliedPoints : 0);
  const suppliedProgress = experience.progress;
  const currentThreshold = Number(suppliedProgress?.currentThreshold);
  const nextThreshold = Number(suppliedProgress?.nextThreshold);
  const suppliedPercent = Number(suppliedProgress?.percent);
  const progress = {
    ...computedProgress,
    level:
      Number.isFinite(suppliedProgress?.level) && suppliedProgress.level > 0
        ? Math.floor(suppliedProgress.level)
        : computedProgress.level,
    title: suppliedProgress?.title || computedProgress.title,
    currentThreshold:
      Number.isFinite(currentThreshold) && currentThreshold >= 0
        ? currentThreshold
        : computedProgress.currentThreshold,
    nextThreshold:
      Number.isFinite(nextThreshold) && nextThreshold > Math.max(0, currentThreshold)
        ? nextThreshold
        : computedProgress.nextThreshold,
    remaining: Number.isFinite(suppliedProgress?.remaining)
      ? Math.max(0, suppliedProgress.remaining)
      : computedProgress.remaining,
    percent: Number.isFinite(suppliedPercent)
      ? Math.min(100, Math.max(0, suppliedPercent))
      : computedProgress.percent,
  };
  const rules = experience.rules?.length ? experience.rules : DEFAULT_XP_RULES;
  const levels = experience.levels?.length ? experience.levels : BASE_LEVELS;

  return (
    <section className="xp-profile-card content-panel" aria-labelledby="xp-profile-title">
      <div className="xp-profile-card__badge" aria-hidden="true">
        <Sparkles />
        <strong>{progress.level}</strong>
      </div>
      <div className="xp-profile-card__content">
        <p className="eyebrow">Progression PokéTerps</p>
        <h2 id="xp-profile-title">
          Niveau {progress.level} · {progress.title}
        </h2>
        <div
          className="xp-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.percent)}
        >
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        <div className="xp-profile-card__numbers">
          <strong>
            {progress.experiencePoints.toLocaleString("fr-CH")} /{" "}
            {progress.nextThreshold.toLocaleString("fr-CH")} XP
          </strong>
          <span>
            Plus que {progress.remaining.toLocaleString("fr-CH")} XP avant le niveau{" "}
            {progress.level + 1}.
          </span>
        </div>
        <button
          className="button button--secondary button--small"
          type="button"
          onClick={() => dialogRef.current?.showModal()}
        >
          En savoir plus sur l’XP
        </button>
      </div>

      <dialog
        className="xp-dialog"
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="xp-dialog__header">
          <div>
            <p className="eyebrow">Niveau {progress.level}</p>
            <h2>Progression PokéTerps</h2>
          </div>
          <button type="button" aria-label="Fermer" onClick={() => dialogRef.current?.close()}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="xp-dialog__body">
          <p>
            L’XP récompense uniquement les contributions réellement validées. Les vues, recherches,
            J’aime et ouvertures de l’application ne rapportent aucun point.
          </p>
          <section>
            <h3>Comment gagner de l’XP</h3>
            <div className="xp-rule-list">
              {rules.map((rule) => (
                <div key={rule.key}>
                  <span>{rule.label}</span>
                  <strong>+{rule.points} XP</strong>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3>Prochains niveaux</h3>
            <div className="xp-level-list">
              {levels
                .filter((level) => level.level >= progress.level)
                .slice(0, 5)
                .map((level) => (
                  <div key={level.level}>
                    <span>
                      Niveau {level.level} · {level.title}
                    </span>
                    <strong>{level.threshold.toLocaleString("fr-CH")} XP</strong>
                  </div>
                ))}
            </div>
          </section>
          {showHistory && (
            <section>
              <h3>Historique XP</h3>
              {(experience.events ?? []).length ? (
                <div className="xp-history">
                  {(experience.events ?? []).map((event) => (
                    <div key={String(event.id)}>
                      <strong className={event.points >= 0 ? "is-positive" : "is-negative"}>
                        {event.points >= 0 ? "+" : ""}
                        {event.points} XP
                      </strong>
                      <span>{event.reason}</span>
                      <small>
                        {event.createdAt
                          ? new Intl.DateTimeFormat("fr-CH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(event.createdAt))
                          : ""}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Aucun gain d’XP pour le moment.</p>
              )}
            </section>
          )}
        </div>
      </dialog>
    </section>
  );
}
