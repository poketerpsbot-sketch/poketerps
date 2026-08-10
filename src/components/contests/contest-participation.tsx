"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LogIn, Send, ShieldCheck, Undo2 } from "lucide-react";

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

  async function participate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contest.requireEntry && !entryId) {
      setFeedback("Choisis une de tes fiches publiées pour participer.");
      return;
    }
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
    setFeedback("Participation envoyée à l’équipe de modération.");
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
        <form className="contest-participation__form" onSubmit={participate}>
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
            {pending ? "Envoi…" : canRejoin ? "Participer à nouveau" : "Envoyer ma participation"}
          </button>
        </form>
      ) : !participation ? (
        <p className="notice">Ce concours n’accepte pas de nouvelle participation actuellement.</p>
      ) : null}

      {feedback && (
        <p className="interaction-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      )}
    </section>
  );
}
