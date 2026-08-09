import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import { UserAdminActions } from "@/components/admin/user-admin-actions";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Utilisateurs · Administration" };

type AdminUser = {
  id: string | number;
  displayName: string;
  publicSlug?: string | null;
  telegramUsername?: string | null;
  role: string;
  isSystem?: boolean;
  isBanned?: boolean;
  suspensionReason?: string | null;
  level?: number | null;
  experiencePoints?: number | null;
  captureCount?: number | null;
  reviewCount?: number | null;
  createdAt?: string | null;
  lastSeenAt?: string | null;
};

const allowedRoles = new Set(["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"]);

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; role?: string; banned?: string }>;
}) {
  const params = await searchParams;
  const query = params.query?.trim().slice(0, 120) ?? "";
  const role = params.role && allowedRoles.has(params.role) ? params.role : "";
  const banned = params.banned === "true" || params.banned === "false" ? params.banned : "";
  const apiParams = new URLSearchParams({ limit: "100", offset: "0" });
  if (query) apiParams.set("query", query);
  if (role) apiParams.set("role", role);
  if (banned) apiParams.set("banned", banned);
  const result = await serverApi<unknown>(`/api/admin/users?${apiParams}`);
  const users = unwrapList<AdminUser>(result.data, ["users"]);

  return (
    <>
      <AdminHeader
        eyebrow="Comptes et permissions"
        title="Utilisateurs"
        description="Recherche les membres, attribue les rôles et traite les suspensions. Les identifiants Telegram ne sont jamais affichés."
      />
      <form className="content-panel admin-filter-bar" method="get" action="/admin/utilisateurs">
        <div className="field">
          <label htmlFor="admin-user-query">Nom ou pseudo</label>
          <input id="admin-user-query" name="query" defaultValue={query} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="admin-user-role">Rôle</label>
          <select id="admin-user-role" name="role" defaultValue={role}>
            <option value="">Tous</option>
            {[...allowedRoles].map((value) => (
              <option value={value} key={value}>
                {value.toLocaleLowerCase("fr-FR")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="admin-user-banned">État</label>
          <select id="admin-user-banned" name="banned" defaultValue={banned}>
            <option value="">Tous</option>
            <option value="false">Actifs</option>
            <option value="true">Suspendus</option>
          </select>
        </div>
        <div className="button-row">
          <button className="button" type="submit">
            Filtrer
          </button>
          {(query || role || banned) && (
            <Link className="button button--secondary" href="/admin/utilisateurs">
              Effacer
            </Link>
          )}
        </div>
      </form>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/admin/utilisateurs" />
      ) : users.length === 0 ? (
        <EmptyState
          title="Aucun utilisateur"
          description="Aucun compte ne correspond à ces filtres."
        />
      ) : (
        <div className="admin-list">
          {users.map((user) => (
            <article className="content-panel admin-list__item" key={String(user.id)}>
              <div className="admin-list__copy">
                <div className="button-row">
                  <StatusPill
                    value={user.isSystem ? "SYSTEM" : user.isBanned ? "BANNED" : user.role}
                  />
                  {user.level != null && <span>Niveau {user.level}</span>}
                  <span>Inscrit le {formatDate(user.createdAt)}</span>
                </div>
                <h2>{user.displayName}</h2>
                <p className="muted">
                  {user.telegramUsername
                    ? `@${user.telegramUsername}`
                    : "Pseudo Telegram non public"}
                </p>
                <dl className="data-list admin-user-summary">
                  {typeof user.captureCount === "number" && (
                    <div>
                      <dt>Captures</dt>
                      <dd>{user.captureCount}</dd>
                    </div>
                  )}
                  {typeof user.reviewCount === "number" && (
                    <div>
                      <dt>Avis validés</dt>
                      <dd>{user.reviewCount}</dd>
                    </div>
                  )}
                  {typeof user.experiencePoints === "number" && (
                    <div>
                      <dt>Expérience</dt>
                      <dd>{user.experiencePoints} XP</dd>
                    </div>
                  )}
                  <div>
                    <dt>Dernière activité</dt>
                    <dd>{formatDate(user.lastSeenAt)}</dd>
                  </div>
                </dl>
                {user.publicSlug && (
                  <Link
                    className="text-link"
                    href={`/profil/${encodeURIComponent(user.publicSlug)}`}
                  >
                    Voir le profil public <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
              {user.isSystem ? (
                <div className="admin-action-stack admin-user-actions">
                  <strong>Compte technique protégé</strong>
                  <p className="muted">Les rôles et suspensions ne sont pas modifiables.</p>
                </div>
              ) : (
                <UserAdminActions
                  userId={String(user.id)}
                  role={user.role}
                  isBanned={Boolean(user.isBanned)}
                  suspensionReason={user.suspensionReason}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
