import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Journal d’audit · Administration" };

type AuditLog = {
  id: string | number;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  source?: string | null;
  requestId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
};

function formatPayload(value: unknown) {
  if (value === null || value === undefined) return "Aucune donnée";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Donnée non affichable";
  }
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const page = Math.max(1, Number.parseInt(first("page"), 10) || 1);
  const filters = {
    query: first("query").slice(0, 120),
    action: first("action").slice(0, 120),
    entityType: first("entityType").slice(0, 80),
    entityId: first("entityId").slice(0, 120),
    actorId: first("actorId"),
    role: first("role"),
    source: first("source"),
    dateFrom: first("dateFrom"),
    dateTo: first("dateTo"),
  };
  const limit = 20;
  const apiParams = new URLSearchParams({
    limit: String(limit),
    offset: String((page - 1) * limit),
  });
  Object.entries(filters).forEach(([key, value]) => value && apiParams.set(key, value));
  const result = await serverApi<unknown>(`/api/admin/audit?${apiParams}`);
  const logs = unwrapList<AuditLog>(result.data, ["logs"]);
  const pagination =
    result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? (result.data as { pagination?: { total?: number } }).pagination
      : undefined;
  const total = pagination?.total ?? logs.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <AdminHeader
        eyebrow="Traçabilité"
        title="Journal d’audit"
        description="Consulte les actions sensibles enregistrées par le web, Telegram et les traitements système."
      />
      <form className="content-panel admin-filter-bar" method="get" action="/admin/journal">
        <div className="field">
          <label htmlFor="audit-query">Recherche</label>
          <input
            id="audit-query"
            name="query"
            defaultValue={filters.query}
            maxLength={120}
            placeholder="Action, objet ou acteur"
          />
        </div>
        <div className="field">
          <label htmlFor="audit-action">Action exacte</label>
          <input
            id="audit-action"
            name="action"
            defaultValue={filters.action}
            maxLength={120}
            placeholder="ENTRY_PUBLISHED"
          />
        </div>
        <div className="field">
          <label htmlFor="audit-entity">Type d’entité</label>
          <input
            id="audit-entity"
            name="entityType"
            defaultValue={filters.entityType}
            maxLength={80}
            placeholder="ENTRY"
          />
        </div>
        <div className="field">
          <label htmlFor="audit-entity-id">ID objet</label>
          <input
            id="audit-entity-id"
            name="entityId"
            defaultValue={filters.entityId}
            maxLength={120}
          />
        </div>
        <div className="field">
          <label htmlFor="audit-actor-id">ID utilisateur interne</label>
          <input
            id="audit-actor-id"
            name="actorId"
            defaultValue={filters.actorId}
            inputMode="text"
          />
        </div>
        <div className="field">
          <label htmlFor="audit-role">Rôle acteur</label>
          <select id="audit-role" name="role" defaultValue={filters.role}>
            <option value="">Tous</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MODERATOR">Modérateur</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-source">Source</label>
          <select id="audit-source" name="source" defaultValue={filters.source}>
            <option value="">Toutes</option>
            <option value="WEB_ADMIN">Web admin</option>
            <option value="TELEGRAM_ADMIN">Telegram admin</option>
            <option value="MINI_APP">Mini App</option>
            <option value="SYSTEM">Système</option>
            <option value="API">API</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-from">Du</label>
          <input id="audit-from" name="dateFrom" type="date" defaultValue={filters.dateFrom} />
        </div>
        <div className="field">
          <label htmlFor="audit-to">Au</label>
          <input id="audit-to" name="dateTo" type="date" defaultValue={filters.dateTo} />
        </div>
        <div className="button-row">
          <button className="button" type="submit">
            Filtrer
          </button>
          {Object.values(filters).some(Boolean) && (
            <Link className="button button--secondary" href="/admin/journal">
              Effacer
            </Link>
          )}
        </div>
      </form>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/admin/journal" />
      ) : logs.length === 0 ? (
        <EmptyState title="Journal vide" description="Aucune action ne correspond à ces filtres." />
      ) : (
        <div className="admin-audit-list">
          {logs.map((log) => (
            <article className="content-panel admin-audit-item" key={String(log.id)}>
              <header>
                <div className="button-row">
                  <StatusPill value={log.source} />
                  <span>{formatDate(log.createdAt)}</span>
                </div>
                <h2>{log.action.replaceAll("_", " ").toLocaleLowerCase("fr-FR")}</h2>
                <p>
                  <strong>{log.actorName ?? "Système"}</strong> · {log.entityType}
                  {log.entityId ? ` · ${log.entityId}` : ""}
                </p>
              </header>
              <Link
                className="button button--secondary"
                href={`/admin/journal/${encodeURIComponent(String(log.id))}`}
              >
                Ouvrir la trace complète
              </Link>
              {((log.before !== null && log.before !== undefined) ||
                (log.after !== null && log.after !== undefined)) && (
                <details>
                  <summary>Voir les changements</summary>
                  <div className="admin-audit-diff">
                    <div>
                      <strong>Avant</strong>
                      <pre>{formatPayload(log.before)}</pre>
                    </div>
                    <div>
                      <strong>Après</strong>
                      <pre>{formatPayload(log.after)}</pre>
                    </div>
                  </div>
                </details>
              )}
              <footer>{log.requestId && <code>requête {log.requestId}</code>}</footer>
            </article>
          ))}
        </div>
      )}
      {totalPages > 1 && (
        <nav className="pagination" aria-label="Pages du journal d’audit">
          {page > 1 && (
            <Link
              href={`/admin/journal?${new URLSearchParams({ ...filters, page: String(page - 1) })}`}
            >
              ←
            </Link>
          )}
          <span aria-current="page">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/journal?${new URLSearchParams({ ...filters, page: String(page + 1) })}`}
            >
              →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
