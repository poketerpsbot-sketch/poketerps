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
  searchParams: Promise<{ action?: string; entityType?: string }>;
}) {
  const params = await searchParams;
  const action = params.action?.trim().slice(0, 120) ?? "";
  const entityType = params.entityType?.trim().slice(0, 80) ?? "";
  const apiParams = new URLSearchParams({ limit: "100", offset: "0" });
  if (action) apiParams.set("action", action);
  if (entityType) apiParams.set("entityType", entityType);
  const result = await serverApi<unknown>(`/api/admin/audit?${apiParams}`);
  const logs = unwrapList<AuditLog>(result.data, ["logs"]);

  return (
    <>
      <AdminHeader
        eyebrow="Traçabilité"
        title="Journal d’audit"
        description="Consulte les actions sensibles enregistrées par le web, Telegram et les traitements système."
      />
      <form className="content-panel admin-filter-bar" method="get" action="/admin/journal">
        <div className="field">
          <label htmlFor="audit-action">Action exacte</label>
          <input
            id="audit-action"
            name="action"
            defaultValue={action}
            maxLength={120}
            placeholder="ENTRY_PUBLISHED"
          />
        </div>
        <div className="field">
          <label htmlFor="audit-entity">Type d’entité</label>
          <input
            id="audit-entity"
            name="entityType"
            defaultValue={entityType}
            maxLength={80}
            placeholder="ENTRY"
          />
        </div>
        <div className="button-row">
          <button className="button" type="submit">
            Filtrer
          </button>
          {(action || entityType) && (
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
    </>
  );
}
