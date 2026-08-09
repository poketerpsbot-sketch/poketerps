import type { Metadata } from "next";
import Link from "next/link";
import { AdminMessageActions } from "@/components/admin/admin-actions";
import type { AdminMessageDto } from "@/components/data/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState, formatDate, StatusPill } from "@/components/ui/states";

export const metadata: Metadata = { title: "Messages" };

const allowedTypes = new Set(["IMPROVEMENT", "BUG", "REPORT", "OTHER"]);
const allowedStatuses = new Set(["NEW", "READ", "IN_PROGRESS", "RESOLVED", "ARCHIVED", "REJECTED"]);

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; type?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params.query?.trim().slice(0, 120) ?? "";
  const type = params.type && allowedTypes.has(params.type) ? params.type : "";
  const status = params.status && allowedStatuses.has(params.status) ? params.status : "";
  const apiParams = new URLSearchParams({ limit: "100", offset: "0" });
  if (query) apiParams.set("query", query);
  if (type) apiParams.set("type", type);
  if (status) apiParams.set("status", status);
  const result = await serverApi<unknown>(`/api/admin/messages?${apiParams}`);
  const messages = unwrapList<AdminMessageDto>(result.data, ["messages"]);
  return (
    <>
      <header className="page-header page-header--compact">
        <div className="page-header__copy">
          <p className="eyebrow">Boîte de réception</p>
          <h1 className="page-title">Messages et signalements</h1>
          <p>Centralise les demandes, signalements et propositions reçus.</p>
        </div>
      </header>
      <form className="content-panel admin-filter-bar" method="get" action="/admin/messages">
        <div className="field">
          <label htmlFor="message-query">Recherche</label>
          <input id="message-query" name="query" defaultValue={query} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="message-type">Type</label>
          <select id="message-type" name="type" defaultValue={type}>
            <option value="">Tous</option>
            <option value="IMPROVEMENT">Améliorations</option>
            <option value="BUG">Bugs</option>
            <option value="REPORT">Signalements</option>
            <option value="OTHER">Autres</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="message-status">État</label>
          <select id="message-status" name="status" defaultValue={status}>
            <option value="">Tous</option>
            {[...allowedStatuses].map((value) => (
              <option value={value} key={value}>
                {value.replaceAll("_", " ").toLocaleLowerCase("fr-FR")}
              </option>
            ))}
          </select>
        </div>
        <div className="button-row">
          <button className="button" type="submit">
            Filtrer
          </button>
          {(query || type || status) && (
            <Link className="button button--secondary" href="/admin/messages">
              Effacer
            </Link>
          )}
        </div>
      </form>
      {result.error ? (
        <ErrorState message={result.error} retryHref="/admin/messages" />
      ) : messages.length === 0 ? (
        <EmptyState title="Aucun message" description="La boîte de réception est vide." />
      ) : (
        <div className="admin-list">
          {messages.map((message) => (
            <article className="content-panel admin-list__item" key={String(message.id)}>
              <div className="admin-list__copy">
                <div className="button-row">
                  <StatusPill value={message.status} />
                  {message.type && <StatusPill value={message.type} />}
                  {message.priority && (
                    <span>Priorité {message.priority.toLocaleLowerCase("fr-FR")}</span>
                  )}
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <h2>{message.subject}</h2>
                <p>{message.content ?? "Contenu non renseigné."}</p>
                <p className="muted">
                  {message.authorDisplayName ?? message.authorDisplayNameSnapshot ?? "Visiteur"}
                  {(message.authorUsername ?? message.authorUsernameSnapshot)
                    ? ` · @${message.authorUsername ?? message.authorUsernameSnapshot}`
                    : ""}
                </p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="button-row" aria-label="Pièces jointes privées">
                    {message.attachments.map((attachment, index) =>
                      attachment.signedUrl ? (
                        <a
                          className="button button--secondary"
                          href={attachment.signedUrl}
                          key={String(attachment.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Pièce jointe {index + 1} ·{" "}
                          {Math.max(1, Math.ceil(attachment.byteSize / 1024))} Ko
                        </a>
                      ) : (
                        <span className="muted" key={String(attachment.id)}>
                          Pièce jointe {index + 1} indisponible
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
              <AdminMessageActions messageId={String(message.id)} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
