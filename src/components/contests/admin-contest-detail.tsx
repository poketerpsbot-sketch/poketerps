"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Check,
  ExternalLink,
  Filter,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";

import { AdminContestForm } from "@/components/contests/admin-contest-form";
import type {
  AdminContest,
  AdminContestParticipation,
  ContestFormValue,
  ContestParticipationStatus,
} from "@/components/contests/types";
import {
  adminContestValue,
  formatContestDate,
  readApiError,
} from "@/components/contests/contest-utils";
import { submitJson } from "@/components/forms/form-api";
import { EmptyState, StatusPill } from "@/components/ui/states";

const participationStatuses: Array<{ value: ContestParticipationStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "Toutes" },
  { value: "PENDING_REVIEW", label: "À valider" },
  { value: "APPROVED", label: "Approuvées" },
  { value: "REJECTED", label: "Refusées" },
  { value: "DISQUALIFIED", label: "Disqualifiées" },
  { value: "WITHDRAWN", label: "Retirées" },
];

type ParticipationDraft = {
  status: Exclude<ContestParticipationStatus, "WITHDRAWN">;
  moderationNote: string;
  manualScore: string;
  rank: string;
  winnerLabel: string;
};

function valueOf(
  row: AdminContestParticipation,
  camel: keyof AdminContestParticipation,
  snake: keyof AdminContestParticipation,
) {
  return row[camel] ?? row[snake];
}

function displayName(row: AdminContestParticipation) {
  return row.display_name ?? "Dresseur Telegram";
}

function initialDraft(row: AdminContestParticipation): ParticipationDraft {
  const status = row.status === "WITHDRAWN" ? "PENDING_REVIEW" : row.status;
  return {
    status,
    moderationNote: String(valueOf(row, "moderationNote", "moderation_note") ?? ""),
    manualScore: String(valueOf(row, "manualScore", "manual_score") ?? "0"),
    rank: String(row.winner_rank ?? ""),
    winnerLabel: row.winner_label ?? "",
  };
}

function participantSearchValue(row: AdminContestParticipation) {
  return `${displayName(row)} ${row.telegram_username ?? ""} ${row.entry_name ?? ""}`.toLocaleLowerCase(
    "fr-FR",
  );
}

export function AdminContestDetail({
  initialContest,
  initialParticipations,
  canManage,
  canManageWinner = canManage,
}: {
  initialContest: AdminContest;
  initialParticipations: AdminContestParticipation[];
  canManage: boolean;
  canManageWinner?: boolean;
}) {
  const router = useRouter();
  const [contest, setContest] = useState(initialContest);
  const [participations, setParticipations] = useState(initialParticipations);
  const [drafts, setDrafts] = useState<Record<string, ParticipationDraft>>(() =>
    Object.fromEntries(initialParticipations.map((row) => [row.id, initialDraft(row)])),
  );
  const [showEditor, setShowEditor] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContestParticipationStatus | "ALL">("ALL");
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");

  async function deleteCurrentContest() {
    if (
      !window.confirm(
        `Supprimer le concours « ${contest.title} » ?\n\nIl sera retiré du site. Ses participations, résultats et traces d’audit resteront conservés.`,
      )
    ) {
      return;
    }
    setPending("delete");
    setFeedback("");
    const result = await submitJson<{ deleted: boolean }>(
      `/api/admin/contests/${encodeURIComponent(contest.id)}`,
      "DELETE",
      {},
    );
    if (!result.ok) {
      setPending("");
      setFeedback(result.message);
      return;
    }
    router.replace("/admin/concours");
    router.refresh();
  }

  async function publishResult() {
    if (!window.confirm("Publier le résultat ? Les participants pourront immédiatement le voir."))
      return;
    setPending("result");
    setFeedback("");
    const result = await submitJson<AdminContest>(
      `/api/admin/contests/${encodeURIComponent(contest.id)}/result`,
      "POST",
      { notifyParticipants: true },
    );
    setPending("");
    if (!result.ok || !result.data) {
      setFeedback(result.message);
      return;
    }
    setContest(result.data);
    setFeedback("Le résultat est publié et les participants ont été notifiés.");
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    return participations.filter((row) => {
      if (filter !== "ALL" && row.status !== filter) return false;
      return !needle || participantSearchValue(row).includes(needle);
    });
  }, [filter, participations, query]);

  async function reload() {
    const [contestResponse, participationResponse] = await Promise.all([
      fetch(`/api/admin/contests/${encodeURIComponent(contest.id)}`, { cache: "no-store" }),
      fetch(
        `/api/admin/contests/${encodeURIComponent(contest.id)}/participations?limit=100&offset=0`,
        { cache: "no-store" },
      ),
    ]);
    if (contestResponse.ok) {
      const payload = (await contestResponse.json()) as { data?: AdminContest };
      if (payload.data) setContest(payload.data);
    }
    if (participationResponse.ok) {
      const payload = (await participationResponse.json()) as {
        data?: AdminContestParticipation[];
      };
      if (Array.isArray(payload.data)) {
        setParticipations(payload.data);
        setDrafts(Object.fromEntries(payload.data.map((row) => [row.id, initialDraft(row)])));
      }
    }
  }

  async function updateContest(value: ContestFormValue) {
    setPending("contest");
    setFeedback("");
    const result = await submitJson<AdminContest>(
      `/api/admin/contests/${encodeURIComponent(contest.id)}`,
      "PATCH",
      value,
    );
    setPending("");
    if (!result.ok || !result.data) {
      setFeedback(result.message);
      return;
    }
    setContest(result.data);
    setShowEditor(false);
    setFeedback("Le concours a été mis à jour.");
  }

  function setDraft(id: string, patch: Partial<ParticipationDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? initialDraft(participations.find((row) => row.id === id)!)),
        ...patch,
      },
    }));
  }

  async function moderate(row: AdminContestParticipation) {
    const draft = drafts[row.id] ?? initialDraft(row);
    setPending(row.id);
    setFeedback("");
    const result = await submitJson(
      `/api/admin/contests/${encodeURIComponent(contest.id)}/participations/${encodeURIComponent(row.id)}`,
      "PATCH",
      {
        status: draft.status,
        moderationNote: draft.moderationNote.trim() || null,
        manualScore: Number(draft.manualScore || 0),
      },
    );
    setPending("");
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setFeedback(`Participation de ${displayName(row)} mise à jour.`);
    await reload();
  }

  async function selectWinner(row: AdminContestParticipation) {
    const draft = drafts[row.id] ?? initialDraft(row);
    const rank = Number(draft.rank);
    if (!Number.isInteger(rank) || rank < 1) {
      setFeedback("Indique un rang gagnant valide (1, 2, 3…).");
      return;
    }
    if (
      !window.confirm(
        `Confirmer ${displayName(row)} comme gagnant n°${rank} ? Cette action est historisée.`,
      )
    ) {
      return;
    }
    setPending(`winner-${row.id}`);
    setFeedback("");
    const result = await submitJson(
      `/api/admin/contests/${encodeURIComponent(contest.id)}/winners`,
      "POST",
      {
        participationId: row.id,
        rank,
        label: draft.winnerLabel.trim() || null,
        prize: contest.reward ?? {},
        replaceExisting: true,
        reason: "Sélection confirmée depuis l’administration",
      },
    );
    setPending("");
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setFeedback(`${displayName(row)} est maintenant au palmarès.`);
    await reload();
  }

  async function removeWinner(row: AdminContestParticipation) {
    if (!row.winner_id || !window.confirm("Retirer ce Dresseur du palmarès ?")) return;
    setPending(`winner-${row.id}`);
    setFeedback("");
    try {
      const response = await fetch(
        `/api/admin/contests/${encodeURIComponent(contest.id)}/winners/${encodeURIComponent(row.winner_id)}`,
        { method: "DELETE", headers: { accept: "application/json" } },
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setFeedback(readApiError(payload, "Le gagnant n’a pas pu être retiré."));
        return;
      }
      setFeedback(`${displayName(row)} a été retiré du palmarès.`);
      await reload();
    } catch {
      setFeedback("Le service est injoignable. Réessaie dans un instant.");
    } finally {
      setPending("");
    }
  }

  const contestEnded =
    contest.status === "ENDED" || new Date(adminContestValue(contest).endsAt) <= new Date();

  return (
    <>
      <section className="content-panel admin-contest-overview">
        <div>
          <p className="eyebrow">{contest.slug}</p>
          <h2>{contest.title}</h2>
          <p>{contest.summary}</p>
          <div className="button-row">
            <StatusPill value={contest.status} />
            <span>Début : {formatContestDate(adminContestValue(contest).startsAt)}</span>
            <span>Fin : {formatContestDate(adminContestValue(contest).endsAt)}</span>
          </div>
        </div>
        <div className="button-row">
          {!["DRAFT", "CANCELLED"].includes(contest.status) && (
            <Link
              className="button button--secondary"
              href={`/concours/${encodeURIComponent(contest.slug)}`}
            >
              <ExternalLink aria-hidden="true" /> Voir la page
            </Link>
          )}
          {canManage && (
            <>
              <button
                className="button button--dark"
                type="button"
                onClick={() => setShowEditor((open) => !open)}
              >
                {showEditor ? <X aria-hidden="true" /> : <Save aria-hidden="true" />}
                {showEditor ? "Fermer" : "Modifier"}
              </button>
              {contestEnded && !contest.resultPublishedAt && (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={pending === "result"}
                  onClick={() => void publishResult()}
                >
                  <Trophy aria-hidden="true" /> Publier le résultat
                </button>
              )}
              <button
                className="button button--danger"
                type="button"
                disabled={pending === "delete"}
                onClick={() => void deleteCurrentContest()}
              >
                <Trash2 aria-hidden="true" />
                {pending === "delete" ? "Suppression…" : "Supprimer"}
              </button>
            </>
          )}
        </div>
      </section>

      {canManage && showEditor && (
        <section className="content-panel">
          <h2>Modifier le concours</h2>
          <AdminContestForm
            initialValue={adminContestValue(contest)}
            submitLabel="Enregistrer les changements"
            pending={pending === "contest"}
            onSubmit={updateContest}
          />
        </section>
      )}

      <section className="admin-contest-metrics" aria-label="Résumé des participations">
        <article>
          <UserRound aria-hidden="true" />
          <span>Total</span>
          <strong>{participations.length}</strong>
        </article>
        <article>
          <ShieldAlert aria-hidden="true" />
          <span>À modérer</span>
          <strong>{participations.filter((row) => row.status === "PENDING_REVIEW").length}</strong>
        </article>
        <article>
          <Check aria-hidden="true" />
          <span>Approuvées</span>
          <strong>{participations.filter((row) => row.status === "APPROVED").length}</strong>
        </article>
        <article>
          <Trophy aria-hidden="true" />
          <span>Gagnants</span>
          <strong>{participations.filter((row) => row.winner_id).length}</strong>
        </article>
      </section>

      <section
        className="content-panel admin-contest-filters"
        aria-label="Filtres des participants"
      >
        <div className="field">
          <label htmlFor="participant-query">
            <Search aria-hidden="true" /> Rechercher
          </label>
          <input
            id="participant-query"
            type="search"
            value={query}
            placeholder="Pseudo, @username ou fiche…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="participant-status">
            <Filter aria-hidden="true" /> Statut
          </label>
          <select
            id="participant-status"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            {participationStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {feedback && (
        <p className="admin-action-feedback" role="status">
          {feedback}
        </p>
      )}

      {visible.length ? (
        <div className="admin-participation-list">
          {visible.map((row) => {
            const draft = drafts[row.id] ?? initialDraft(row);
            const submittedAt = String(valueOf(row, "submittedAt", "submitted_at") ?? "");
            return (
              <article className="content-panel admin-participation-card" key={row.id}>
                <header>
                  <div className="admin-participation-card__identity">
                    <span className="avatar" aria-hidden="true">
                      {displayName(row).charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <h3>{displayName(row)}</h3>
                      <p>
                        {row.telegram_username
                          ? `@${row.telegram_username}`
                          : (row.role ?? "Membre")}
                      </p>
                    </div>
                  </div>
                  <StatusPill value={row.status} />
                </header>
                <div className="admin-participation-card__details">
                  <p>
                    <strong>Envoyée :</strong> {formatContestDate(submittedAt)}
                  </p>
                  {row.entry_name && (
                    <p>
                      <strong>Fiche :</strong>{" "}
                      {row.entry_slug ? (
                        <Link
                          className="text-link"
                          href={`/fiches/${encodeURIComponent(row.entry_slug)}`}
                        >
                          {row.entry_name}
                        </Link>
                      ) : (
                        row.entry_name
                      )}
                    </p>
                  )}
                  {row.statement && <blockquote>{row.statement}</blockquote>}
                </div>

                {row.status !== "WITHDRAWN" && (
                  <div className="admin-participation-card__moderation">
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor={`participant-status-${row.id}`}>Décision</label>
                        <select
                          id={`participant-status-${row.id}`}
                          value={draft.status}
                          onChange={(event) =>
                            setDraft(row.id, {
                              status: event.target.value as ParticipationDraft["status"],
                            })
                          }
                        >
                          <option value="PENDING_REVIEW">À vérifier</option>
                          <option value="APPROVED">Approuver</option>
                          <option value="REJECTED">Refuser</option>
                          <option value="DISQUALIFIED">Disqualifier</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`participant-score-${row.id}`}>Score manuel</label>
                        <input
                          id={`participant-score-${row.id}`}
                          type="number"
                          step="any"
                          value={draft.manualScore}
                          onChange={(event) =>
                            setDraft(row.id, { manualScore: event.target.value })
                          }
                        />
                      </div>
                      <div className="field field--wide">
                        <label htmlFor={`participant-note-${row.id}`}>Note interne</label>
                        <textarea
                          id={`participant-note-${row.id}`}
                          maxLength={2000}
                          value={draft.moderationNote}
                          onChange={(event) =>
                            setDraft(row.id, { moderationNote: event.target.value })
                          }
                        />
                      </div>
                    </div>
                    <button
                      className="button button--dark"
                      type="button"
                      disabled={pending === row.id}
                      onClick={() => moderate(row)}
                    >
                      <Save aria-hidden="true" />{" "}
                      {pending === row.id ? "Enregistrement…" : "Enregistrer la modération"}
                    </button>
                  </div>
                )}

                {canManageWinner && row.status === "APPROVED" && (
                  <div className="admin-participation-card__winner">
                    <h4>
                      <Award aria-hidden="true" /> Palmarès
                    </h4>
                    {row.winner_id ? (
                      <div className="button-row">
                        <strong>Gagnant #{row.winner_rank}</strong>
                        {row.winner_label && <span>{row.winner_label}</span>}
                        <button
                          className="button button--danger"
                          type="button"
                          disabled={pending === `winner-${row.id}`}
                          onClick={() => removeWinner(row)}
                        >
                          <Trash2 aria-hidden="true" /> Retirer
                        </button>
                      </div>
                    ) : (
                      <div className="admin-winner-form">
                        <div className="field">
                          <label htmlFor={`winner-rank-${row.id}`}>Rang</label>
                          <input
                            id={`winner-rank-${row.id}`}
                            type="number"
                            min={1}
                            max={1000}
                            value={draft.rank}
                            onChange={(event) => setDraft(row.id, { rank: event.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`winner-label-${row.id}`}>Titre ou prix</label>
                          <input
                            id={`winner-label-${row.id}`}
                            maxLength={180}
                            value={draft.winnerLabel}
                            placeholder="Grand gagnant…"
                            onChange={(event) =>
                              setDraft(row.id, { winnerLabel: event.target.value })
                            }
                          />
                        </div>
                        <button
                          className="button"
                          type="button"
                          disabled={!contestEnded || pending === `winner-${row.id}`}
                          onClick={() => selectWinner(row)}
                        >
                          <Trophy aria-hidden="true" />{" "}
                          {pending === `winner-${row.id}`
                            ? "Attribution…"
                            : "Choisir comme gagnant"}
                        </button>
                        {!contestEnded && (
                          <small>Le palmarès s’ouvre après la fin du concours.</small>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Aucune participation"
          description="Aucune candidature ne correspond à ce filtre."
        />
      )}
    </>
  );
}
