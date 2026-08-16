import type { Metadata } from "next";
import Link from "next/link";
import { Activity, UserRoundSearch } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-header";
import { UserAdminActions } from "@/components/admin/user-admin-actions";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";
import { UserAvatar } from "@/components/ui/user-avatar";

export const metadata: Metadata = { title: "Utilisateurs · Administration" };

type AdminUser = {
  id: string | number;
  displayName: string;
  publicSlug?: string | null;
  telegramUsername?: string | null;
  profilePhotoUrl?: string | null;
  role: string;
  isSystem?: boolean;
  isBanned?: boolean;
  suspensionReason?: string | null;
  suspensionUntil?: string | null;
  level?: number | null;
  experiencePoints?: number | null;
  captureCount?: number | null;
  reviewCount?: number | null;
  badge?: { name?: string | null; icon?: string | null } | null;
  createdAt?: string | null;
  lastSeenAt?: string | null;
  canManage?: boolean;
};

type Pagination = { limit: number; offset: number; total: number };

const allowedRoles = new Set(["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"]);

function AdminUserAvatar({ user }: { user: AdminUser }) {
  return (
    <UserAvatar
      className="ranking-avatar"
      displayName={user.displayName}
      src={user.profilePhotoUrl}
    />
  );
}

function pageNumber(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function paginationFrom(payload: unknown, fallbackLimit: number): Pagination {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { limit: fallbackLimit, offset: 0, total: 0 };
  }
  const candidate = (payload as Record<string, unknown>).pagination;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { limit: fallbackLimit, offset: 0, total: 0 };
  }
  const values = candidate as Record<string, unknown>;
  return {
    limit: typeof values.limit === "number" ? values.limit : fallbackLimit,
    offset: typeof values.offset === "number" ? values.offset : 0,
    total: typeof values.total === "number" ? values.total : 0,
  };
}

function usersPageHref(page: number, filters: { query: string; role: string; banned: string }) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.role) params.set("role", filters.role);
  if (filters.banned) params.set("banned", filters.banned);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/admin/utilisateurs?${queryString}` : "/admin/utilisateurs";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; role?: string; banned?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.query?.trim().slice(0, 120) ?? "";
  const role = params.role && allowedRoles.has(params.role) ? params.role : "";
  const banned = params.banned === "true" || params.banned === "false" ? params.banned : "";
  const page = pageNumber(params.page);
  const pageSize = 25;
  const apiParams = new URLSearchParams({
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  });
  if (query) apiParams.set("query", query);
  if (role) apiParams.set("role", role);
  if (banned) apiParams.set("banned", banned);
  const result = await serverApi<unknown>(`/api/admin/users?${apiParams}`);
  const users = unwrapList<AdminUser>(result.data, ["users"]);
  const pagination = paginationFrom(result.data, pageSize);
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const filters = { query, role, banned };

  return (
    <>
      <AdminHeader
        eyebrow="Comptes et permissions"
        title="Utilisateurs"
        description="Recherche les membres, attribue les rôles et traite les suspensions. Les identifiants Telegram ne sont jamais affichés."
        actions={
          <Link className="button button--secondary" href="/admin/equipe">
            <Activity aria-hidden="true" /> Équipe & activité
          </Link>
        }
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
                <AdminUserAvatar user={user} />
                <div className="button-row">
                  <StatusPill
                    value={user.isSystem ? "SYSTEM" : user.isBanned ? "BANNED" : user.role}
                  />
                  {user.level != null && <span>Niveau {user.level}</span>}
                  {user.badge?.name && (
                    <span className="status-pill">
                      <span aria-hidden="true">{user.badge.icon || "🏅"}</span> {user.badge.name}
                    </span>
                  )}
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
                <Link
                  className="button button--secondary"
                  href={`/admin/utilisateurs/${encodeURIComponent(String(user.id))}`}
                >
                  <UserRoundSearch aria-hidden="true" /> Ouvrir le dossier interne
                </Link>
              </div>
              {!user.canManage ? (
                <div className="admin-action-stack admin-user-actions">
                  <strong>Compte protégé</strong>
                  <p className="muted">
                    Ce compte est technique, personnel ou d’un niveau égal ou supérieur.
                  </p>
                </div>
              ) : (
                <UserAdminActions
                  userId={String(user.id)}
                  role={user.role}
                  isBanned={Boolean(user.isBanned)}
                  suspensionReason={user.suspensionReason}
                  suspensionUntil={user.suspensionUntil}
                />
              )}
            </article>
          ))}
        </div>
      )}
      {!result.error && totalPages > 1 && (
        <nav className="pagination admin-user-pagination" aria-label="Pagination des utilisateurs">
          {page > 1 && (
            <Link href={usersPageHref(page - 1, filters)} aria-label="Page précédente">
              ←
            </Link>
          )}
          <span aria-current="page">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={usersPageHref(page + 1, filters)} aria-label="Page suivante">
              →
            </Link>
          )}
        </nav>
      )}
      {!result.error && pagination.total > 0 && (
        <p className="muted admin-user-pagination__total">
          {pagination.total.toLocaleString("fr-CH")} utilisateur(s) au total
        </p>
      )}
    </>
  );
}
