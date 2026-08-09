"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, Eye, EyeOff, Plus } from "lucide-react";
import { submitJson } from "@/components/forms/form-api";

export type AdminBadge = {
  id: string | number;
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  kind?: string | null;
  criteria?: Record<string, unknown> | null;
  isActive?: boolean;
  sortOrder?: number | null;
  assignmentCount?: number | null;
};

export type BadgeUserOption = {
  id: string | number;
  displayName: string;
  telegramUsername?: string | null;
  isSystem?: boolean;
};

export type AdminBadgeAssignment = {
  id: string | number;
  badgeId: string | number;
  userId: string | number;
  isActive?: boolean;
  activeFrom?: string | null;
  activeUntil?: string | null;
  user?: BadgeUserOption & { publicSlug?: string | null };
};

export function BadgeAdmin({
  badges,
  users,
  assignments,
}: {
  badges: AdminBadge[];
  users: BadgeUserOption[];
  assignments: AdminBadgeAssignment[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const endpoint = "/api/admin/badges";
    setPending(endpoint);
    setFeedback("");
    const result = await submitJson(endpoint, "POST", {
      name: String(data.get("name") ?? ""),
      slug: String(data.get("slug") ?? ""),
      description: String(data.get("description") ?? "") || null,
      icon: String(data.get("icon") ?? "") || null,
      kind: String(data.get("kind") ?? "PERMANENT"),
      criteria: {},
      isActive: true,
      sortOrder: Number(data.get("sortOrder") ?? 0),
    });
    setPending("");
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    form.reset();
    setFeedback("Badge créé.");
    router.refresh();
  }

  async function toggle(badge: AdminBadge) {
    const endpoint = `/api/admin/badges/${encodeURIComponent(String(badge.id))}`;
    setPending(endpoint);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", { isActive: badge.isActive === false });
    setPending("");
    setFeedback(result.ok ? "Disponibilité du badge mise à jour." : result.message);
    if (result.ok) router.refresh();
  }

  async function assign(event: FormEvent<HTMLFormElement>, badge: AdminBadge) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const endpoint = `/api/admin/badges/${encodeURIComponent(String(badge.id))}/assignments`;
    setPending(endpoint);
    setFeedback("");
    const result = await submitJson(endpoint, "POST", {
      userId: String(data.get("userId") ?? ""),
      activeFrom: null,
      activeUntil: null,
      metadata: { source: "admin_web" },
    });
    setPending("");
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    form.reset();
    setFeedback("Badge attribué.");
    router.refresh();
  }

  async function revoke(event: FormEvent<HTMLFormElement>, assignment: AdminBadgeAssignment) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const endpoint = `/api/admin/badge-assignments/${encodeURIComponent(String(assignment.id))}`;
    if (!window.confirm("Retirer ce badge à l’utilisateur ?")) return;
    setPending(endpoint);
    setFeedback("");
    const result = await submitJson(endpoint, "PATCH", {
      isActive: false,
      reason: String(data.get("reason") ?? ""),
    });
    setPending("");
    setFeedback(result.ok ? "Attribution révoquée." : result.message);
    if (result.ok) router.refresh();
  }

  return (
    <div className="page-stack">
      <details className="content-panel admin-disclosure">
        <summary>Créer un badge</summary>
        <form className="form-stack" onSubmit={create}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="badge-name">Nom</label>
              <input id="badge-name" name="name" required minLength={2} maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="badge-slug">Slug</label>
              <input
                id="badge-slug"
                name="slug"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={120}
              />
            </div>
            <div className="field">
              <label htmlFor="badge-icon">Icône</label>
              <input id="badge-icon" name="icon" maxLength={24} placeholder="🏅" />
            </div>
            <div className="field">
              <label htmlFor="badge-kind">Type</label>
              <select id="badge-kind" name="kind" defaultValue="PERMANENT">
                <option value="PERMANENT">Permanent</option>
                <option value="ACTIVE">Actif</option>
                <option value="HISTORICAL">Historique</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="badge-order">Ordre</label>
              <input id="badge-order" name="sortOrder" type="number" min={0} defaultValue={0} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="badge-description">Description</label>
            <textarea id="badge-description" name="description" rows={3} maxLength={1_500} />
          </div>
          <button className="button" type="submit" disabled={pending === "/api/admin/badges"}>
            <Plus size={16} aria-hidden="true" />
            {pending === "/api/admin/badges" ? "Création…" : "Créer le badge"}
          </button>
        </form>
      </details>

      {feedback && (
        <p className="admin-action-feedback" aria-live="polite">
          {feedback}
        </p>
      )}

      <div className="admin-card-grid">
        {badges.map((badge) => {
          const endpoint = `/api/admin/badges/${encodeURIComponent(String(badge.id))}`;
          const assignEndpoint = `${endpoint}/assignments`;
          const badgeAssignments = assignments.filter(
            (assignment) => String(assignment.badgeId) === String(badge.id),
          );
          return (
            <article className="content-panel admin-badge-card" key={String(badge.id)}>
              <header>
                <span className="admin-badge-card__icon" aria-hidden="true">
                  {badge.icon || "🏅"}
                </span>
                <div>
                  <p className="eyebrow">{badge.kind?.toLocaleLowerCase("fr-FR") || "badge"}</p>
                  <h2>{badge.name}</h2>
                </div>
              </header>
              <p>{badge.description || "Aucune description."}</p>
              <p className="muted">{badgeAssignments.length} attribution(s) active(s)</p>
              <button
                className="button button--secondary"
                type="button"
                disabled={pending === endpoint}
                onClick={() => toggle(badge)}
              >
                {badge.isActive === false ? (
                  <Eye size={15} aria-hidden="true" />
                ) : (
                  <EyeOff size={15} aria-hidden="true" />
                )}
                {badge.isActive === false ? "Réactiver" : "Désactiver"}
              </button>
              <form
                className="form-stack admin-badge-assignment"
                onSubmit={(event) => assign(event, badge)}
              >
                <div className="field">
                  <label htmlFor={`badge-user-${badge.id}`}>Attribuer à</label>
                  <select id={`badge-user-${badge.id}`} name="userId" required defaultValue="">
                    <option value="" disabled>
                      Choisir un utilisateur
                    </option>
                    {users.map((user) => (
                      <option value={String(user.id)} key={String(user.id)}>
                        {user.displayName}
                        {user.telegramUsername ? ` · @${user.telegramUsername}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="button"
                  type="submit"
                  disabled={pending === assignEndpoint || users.length === 0}
                >
                  <Award size={15} aria-hidden="true" />
                  {pending === assignEndpoint ? "Attribution…" : "Attribuer"}
                </button>
              </form>
              <details className="admin-badge-assignments">
                <summary>Attributions actives ({badgeAssignments.length})</summary>
                {badgeAssignments.length ? (
                  <div className="admin-field-list">
                    {badgeAssignments.map((assignment) => (
                      <div key={String(assignment.id)}>
                        <div>
                          {assignment.user?.publicSlug ? (
                            <Link
                              href={`/profil/${encodeURIComponent(assignment.user.publicSlug)}`}
                            >
                              <strong>{assignment.user.displayName}</strong>
                            </Link>
                          ) : (
                            <strong>{assignment.user?.displayName ?? "Utilisateur"}</strong>
                          )}
                          <span>
                            {assignment.user?.telegramUsername
                              ? `@${assignment.user.telegramUsername}`
                              : "Sans pseudo public"}
                          </span>
                        </div>
                        <form
                          className="admin-inline-form"
                          onSubmit={(event) => revoke(event, assignment)}
                        >
                          <label className="sr-only" htmlFor={`revoke-reason-${assignment.id}`}>
                            Motif du retrait
                          </label>
                          <input
                            id={`revoke-reason-${assignment.id}`}
                            name="reason"
                            required
                            maxLength={1_000}
                            placeholder="Motif du retrait"
                          />
                          <button
                            className="button button--danger"
                            type="submit"
                            disabled={
                              pending ===
                              `/api/admin/badge-assignments/${encodeURIComponent(String(assignment.id))}`
                            }
                          >
                            Retirer
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Aucune attribution active.</p>
                )}
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}
