"use client";

import { useRef } from "react";
import { Sparkles, X } from "lucide-react";

import type { ExperienceOverviewDto } from "@/components/data/types";

export function XpProgressCard({
  experience,
  showHistory = false,
}: {
  experience: ExperienceOverviewDto;
  showHistory?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { progress } = experience;

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
              {(experience.rules ?? []).map((rule) => (
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
              {(experience.levels ?? [])
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
