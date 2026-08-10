"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Filter, Medal, Plus, Search, ShieldCheck, UsersRound, X } from "lucide-react";

import { AdminContestForm } from "@/components/contests/admin-contest-form";
import type { AdminContest, ContestFormValue, ContestStatus } from "@/components/contests/types";
import { contestStatusLabels, formatContestPeriod } from "@/components/contests/contest-utils";
import { submitJson } from "@/components/forms/form-api";
import { EmptyState, StatusPill } from "@/components/ui/states";

const filters: Array<{ value: "ALL" | ContestStatus; label: string }> = [
  { value: "ALL", label: "Tous" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "SCHEDULED", label: "Programmés" },
  { value: "ACTIVE", label: "Actifs" },
  { value: "PAUSED", label: "En pause" },
  { value: "ENDED", label: "Terminés" },
  { value: "CANCELLED", label: "Annulés" },
];

function count(contest: AdminContest, key: "participants" | "pending") {
  const value =
    key === "participants"
      ? (contest.participantCount ?? contest.participation_count)
      : (contest.pendingCount ?? contest.pending_count);
  return Number(value ?? 0);
}

function date(contest: AdminContest, kind: "start" | "end") {
  return kind === "start"
    ? (contest.startsAt ?? contest.starts_at ?? "")
    : (contest.endsAt ?? contest.ends_at ?? "");
}

export function AdminContestManager({
  initialContests,
  canManage,
}: {
  initialContests: AdminContest[];
  canManage: boolean;
}) {
  const [contests, setContests] = useState(initialContests);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ContestStatus>("ALL");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    return contests.filter((contest) => {
      if (status !== "ALL" && contest.status !== status) return false;
      if (!needle) return true;
      return `${contest.title} ${contest.slug}`.toLocaleLowerCase("fr-FR").includes(needle);
    });
  }, [contests, query, status]);

  async function create(value: ContestFormValue) {
    setPending(true);
    setFeedback("");
    const result = await submitJson<AdminContest>("/api/admin/contests", "POST", value);
    setPending(false);
    if (!result.ok || !result.data) {
      setFeedback(result.message);
      return;
    }
    setContests((current) => [result.data!, ...current]);
    setShowCreate(false);
    setFeedback("Concours créé. Tu peux maintenant gérer ses participants.");
  }

  return (
    <>
      {canManage && (
        <div className="admin-contest-create">
          <button
            className="button button--dark"
            type="button"
            onClick={() => setShowCreate((open) => !open)}
          >
            {showCreate ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {showCreate ? "Fermer le formulaire" : "Nouveau concours"}
          </button>
          {showCreate && (
            <section className="content-panel">
              <h2>Créer un concours</h2>
              <p>Commence en brouillon, vérifie les règles puis programme sa publication.</p>
              <AdminContestForm onSubmit={create} pending={pending} />
            </section>
          )}
        </div>
      )}

      <section className="content-panel admin-contest-filters" aria-label="Filtres des concours">
        <div className="field">
          <label htmlFor="admin-contest-query">
            <Search aria-hidden="true" /> Rechercher
          </label>
          <input
            id="admin-contest-query"
            type="search"
            value={query}
            placeholder="Titre ou adresse…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-contest-status">
            <Filter aria-hidden="true" /> Statut
          </label>
          <select
            id="admin-contest-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            {filters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
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
        <div className="admin-contest-grid">
          {visible.map((contest) => (
            <article className="content-panel admin-contest-card" key={contest.id}>
              <header>
                <span className="admin-contest-card__icon">
                  <Medal aria-hidden="true" />
                </span>
                <div>
                  <StatusPill value={contest.status} />
                  {contest.isFeatured || contest.is_featured ? (
                    <span className="type-badge">À la une</span>
                  ) : null}
                </div>
              </header>
              <h2>{contest.title}</h2>
              <p>{contest.summary}</p>
              <span className="admin-contest-card__period">
                {formatContestPeriod(date(contest, "start"), date(contest, "end"))}
              </span>
              <dl>
                <div>
                  <dt>
                    <UsersRound aria-hidden="true" /> Participations
                  </dt>
                  <dd>{count(contest, "participants")}</dd>
                </div>
                <div>
                  <dt>
                    <ShieldCheck aria-hidden="true" /> À modérer
                  </dt>
                  <dd>{count(contest, "pending")}</dd>
                </div>
              </dl>
              <Link
                className="button button--secondary"
                href={`/admin/concours/${encodeURIComponent(contest.id)}`}
              >
                {canManage ? "Gérer le concours" : "Modérer les participants"}
              </Link>
              <small>{contestStatusLabels[contest.status]}</small>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Aucun concours dans ce filtre"
          description="Modifie la recherche ou crée le premier concours de la communauté."
        />
      )}
    </>
  );
}
