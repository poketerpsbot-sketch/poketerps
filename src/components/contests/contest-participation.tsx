"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, LogIn, Send, ShieldCheck, Undo2, X } from "lucide-react";

import type { EntrySummaryDto } from "@/components/data/types";
import type { ContestDetailData, ContestParticipation } from "@/components/contests/types";
import { submitJson } from "@/components/forms/form-api";
import { StatusPill } from "@/components/ui/states";

type ProfileEnvelope = {
  data?: {
    publishedEntries?: EntrySummaryDto[];
  };
  publishedEntries?: EntrySummaryDto[];
};

function publishedEntries(payload: ProfileEnvelope | null) {
  const value = payload?.data?.publishedEntries ?? payload?.publishedEntries;
  return Array.isArray(value) ? value : [];
}

export function ContestParticipationPanel({
  initialContest,
  initialEntries = [],
  initiallyAuthenticated = false,
}: {
  initialContest: ContestDetailData;
  initialEntries?: EntrySummaryDto[];
  initiallyAuthenticated?: boolean;
}) {
  const [contest, setContest] = useState(initialContest);
  const [entries, setEntries] = useState(initialEntries);
  const [authenticated, setAuthenticated] = useState(initiallyAuthenticated);
  const [entryId, setEntryId] = useState(initialContest.viewerParticipation?.entryId ?? "");
  const [statement, setStatement] = useState(initialContest.viewerParticipation?.statement ?? "");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const refreshSession = async () => {
      try {
        const [contestResponse, profileResponse] = await Promise.all([
          fetch(`/api/contests/${encodeURIComponent(initialContest.slug)}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/me", { cache: "no-store", signal: controller.signal }),
        ]);
        if (contestResponse.ok) {
          const payload = (await contestResponse.json()) as { data?: ContestDetailData };
          if (payload.data) setContest(payload.data);
        }
        setAuthenticated(profileResponse.ok);
        if (profileResponse.ok) {
          const payload = (await profileResponse.json()) as ProfileEnvelope;
          setEntries(publishedEntries(payload));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    };
    void refreshSession();
    window.addEventListener("pokedex:session-ready", refreshSession);
    return () => {
      controller.abort();
      window.removeEventListener("pokedex:session-ready", refreshSession);
    };
  }, [initialContest.slug]);

  async function reloadContest() {
    const response = await fetch(`/api/contests/${encodeURIComponent(contest.slug)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { data?: ContestDetailData };
    if (payload.data) setContest(payload.data);
  }

  function requestParticipation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contest.requireEntry && !entryId) {
      setFeedback("Choisis une de tes fiches publiées pour participer.");
      return;
    }
    setFeedback("");
    setConfirmationOpen(true);
  }

  async function participate() {
    setConfirmationOpen(false);
    setPending(true);
    setFeedback("");
    const result = await submitJson<ContestParticipation>(
      `/api/contests/${encodeURIComponent(contest.slug)}/participation`,
      "POST",
      { entryId: entryId || null, statement: statement.trim() || null },
    );
    setPending(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    if (result.data) setContest((current) => ({ ...current, viewerParticipation: result.data }));
    setJoined(true);
    setFeedback("✅ Parfait, tu participes maintenant à ce concours !");
    await reloadContest();
  }

  async function withdraw() {
    if (!window.confirm("Retirer ta participation à ce concours ?")) return;
    setPending(true);
    setFeedback("");
    const result = await submitJson<ContestParticipation>(
      `/api/contests/${encodeURIComponent(contest.slug)}/participation`,
      "DELETE",
      {},
    );
    setPending(false);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    if (result.data) setContest((current) => ({ ...current, viewerParticipation: result.data }));
    setFeedback("Ta participation a été retirée.");
  }

  const participation = contest.viewerParticipation;
  const canRejoin = participation?.status === "WITHDRAWN";
  const canSubmit = contest.participationOpen && (!participation || canRejoin);
  const canWithdraw =
    participation && !["WITHDRAWN", "DISQUALIFIED"].includes(participation.status);
  const showParticipationConfirmation =
    joined ||
    Boolean(participation && ["PENDING_REVIEW", "APPROVED"].includes(participation.status));
  const contestEndLabel = new Intl.DateTimeFormat("fr-CH", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(contest.endsAt));

  return (
    <section className="content-panel contest-participation" aria-labelledby="participation-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Ton défi</p>
          <h2 id="participation-title">Participer</h2>
          <p>
            {contest.participationOpen
              ? "Envoie ta candidature. Elle sera visible au classement après validation."
              : "Les candidatures ne sont pas ouvertes pour le moment."}
          </p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>

      {participation && !canRejoin && (
        <div className="contest-participation__status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Ta participation est enregistrée</strong>
            <p>
              Statut : <StatusPill value={participation.status} />
            </p>
            {participation.statement && <blockquote>{participation.statement}</blockquote>}
          </div>
          {canWithdraw && (
            <button
              className="button button--secondary"
              type="button"
              disabled={pending}
              onClick={withdraw}
            >
              <Undo2 aria-hidden="true" /> Retirer
            </button>
          )}
        </div>
      )}

      {showParticipationConfirmation && (
        <div className="contest-participation__confirmation" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>✅ Parfait, tu participes maintenant à ce concours !</strong>
            <p>Voici les marches à suivre pour participer correctement :</p>
            {contest.instructions && <p>{contest.instructions}</p>}
            {contest.participationSteps.length > 0 && (
              <ol>
                {contest.participationSteps.map((step, index) => (
                  <li key={`${index}-${step}`}>{step}</li>
                ))}
              </ol>
            )}
            {contest.description && (
              <section className="contest-participation__instructions">
                <h3>Explication du concours</h3>
                <p>{contest.description}</p>
              </section>
            )}
            {contest.additionalInformation && (
              <section className="contest-participation__instructions">
                <h3>Informations complémentaires</h3>
                <p>{contest.additionalInformation}</p>
              </section>
            )}
            {contest.rules && (
              <section className="contest-participation__instructions">
                <h3>Règlement</h3>
                <p>{contest.rules}</p>
              </section>
            )}
            {contest.terms && (
              <section className="contest-participation__instructions">
                <h3>Conditions</h3>
                <p>{contest.terms}</p>
              </section>
            )}
            <p>
              <strong>Fin du concours :</strong>{" "}
              <time dateTime={contest.endsAt}>{contestEndLabel}</time>
            </p>
            <div className="button-row">
              {[
                [contest.externalUrl, "Ouvrir le lien"],
                [contest.telegramUrl, "Ouvrir Telegram"],
                [contest.instagramUrl, "Ouvrir Instagram"],
              ].map(([href, label]) =>
                href ? (
                  <a
                    className="button button--secondary"
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    key={label}
                  >
                    <ExternalLink aria-hidden="true" /> {label}
                  </a>
                ) : null,
              )}
            </div>
          </div>
        </div>
      )}

      {!authenticated && !participation ? (
        <div className="contest-participation__login">
          <LogIn aria-hidden="true" />
          <div>
            <strong>Connexion Telegram nécessaire</strong>
            <p>Ouvre cette page depuis le bouton du bot pour participer avec ton profil.</p>
          </div>
          <Link className="button button--dark" href="/profil">
            Voir mon profil
          </Link>
        </div>
      ) : canSubmit ? (
        <form className="contest-participation__form" onSubmit={requestParticipation}>
          {contest.requireEntry && (
            <div className="field">
              <label htmlFor="contest-entry">Fiche publiée</label>
              <select
                id="contest-entry"
                value={entryId}
                required
                onChange={(event) => setEntryId(event.target.value)}
              >
                <option value="">Choisir une fiche…</option>
                {entries.map((entry) => (
                  <option key={String(entry.id)} value={String(entry.id)}>
                    {entry.name}
                  </option>
                ))}
              </select>
              {!entries.length && (
                <small>
                  Tu n’as pas encore de fiche personnelle publiée.{" "}
                  <Link href="/capturer">Proposer une fiche</Link>
                </small>
              )}
            </div>
          )}
          <div className="field">
            <label htmlFor="contest-statement">Message pour le jury (facultatif)</label>
            <textarea
              id="contest-statement"
              maxLength={2000}
              value={statement}
              placeholder="Présente ta participation en quelques lignes…"
              onChange={(event) => setStatement(event.target.value)}
            />
            <small>{statement.length}/2000</small>
          </div>
          <button
            className="button button--dark"
            type="submit"
            disabled={pending || (contest.requireEntry && !entries.length)}
          >
            <Send aria-hidden="true" />{" "}
            {pending ? "Envoi…" : canRejoin ? "Participer à nouveau" : "Participer au concours"}
          </button>
        </form>
      ) : !participation ? (
        contest.isFull ? (
          <div className="contest-participation__closed">
            <button className="button button--dark" type="button" disabled>
              Concours complet
            </button>
            <p className="notice">Plus aucune place disponible.</p>
          </div>
        ) : (
          <p className="notice">
            Ce concours n’accepte pas de nouvelle participation actuellement.
          </p>
        )
      ) : null}

      {confirmationOpen && (
        <div
          className="confirmation-sheet"
          role="presentation"
          onClick={() => setConfirmationOpen(false)}
        >
          <section
            className="confirmation-sheet__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contest-confirmation-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button confirmation-sheet__close"
              type="button"
              aria-label="Annuler"
              onClick={() => setConfirmationOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
            <h3 id="contest-confirmation-title">Tu veux participer à ce concours ?</h3>
            <p>Une seule participation est autorisée par personne pour ce concours.</p>
            <div className="button-row">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setConfirmationOpen(false)}
              >
                Annuler
              </button>
              <button className="button button--dark" type="button" onClick={participate}>
                Confirmer ma participation
              </button>
            </div>
          </section>
        </div>
      )}

      {feedback && (
        <p className="interaction-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      )}
    </section>
  );
}
