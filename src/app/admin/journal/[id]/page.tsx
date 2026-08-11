import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ScrollText, UserRound } from "lucide-react";

import {
  activityEntityHref,
  formatActivityAction,
  safeJson,
} from "@/components/admin/admin-activity-utils";
import { AdminHeader } from "@/components/admin/admin-header";
import type { TeamAuditItemDto } from "@/components/admin/user-activity-types";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { ErrorState, StatusPill, formatDate } from "@/components/ui/states";

export const metadata: Metadata = { title: "Trace d’audit · Administration" };

export default async function AdminAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await serverApi<unknown>(`/api/admin/audit/${encodeURIComponent(id)}`);
  const log = unwrapObject<TeamAuditItemDto>(result.data);
  if (result.error || !log) {
    return (
      <ErrorState
        title="Trace inaccessible"
        message={result.error ?? "La trace n’a pas pu être chargée."}
        retryHref="/admin/journal"
      />
    );
  }
  const entityHref = activityEntityHref(log.entityType, log.entityId);
  return (
    <>
      <Link className="text-link contest-back-link" href="/admin/journal">
        <ArrowLeft aria-hidden="true" /> Retour au journal
      </Link>
      <AdminHeader
        eyebrow="Trace immuable"
        title={formatActivityAction(log.action)}
        description={`Action enregistrée le ${formatDate(log.createdAt)} depuis ${log.source}.`}
        actions={<ScrollText aria-hidden="true" />}
      />
      <section className="content-panel admin-audit-detail">
        <div className="admin-audit-detail__meta">
          <StatusPill value={log.source} />
          <dl className="data-list">
            <div>
              <dt>Auteur</dt>
              <dd>{log.actorName ?? "Système"}</dd>
            </div>
            <div>
              <dt>Rôle au moment de l’action</dt>
              <dd>{log.actorRole ?? "Système"}</dd>
            </div>
            <div>
              <dt>Type d’entité</dt>
              <dd>{log.entityType}</dd>
            </div>
            <div>
              <dt>Identifiant d’entité</dt>
              <dd>{log.entityId ?? "Aucun"}</dd>
            </div>
            <div>
              <dt>Identifiant de requête</dt>
              <dd>{log.requestId ?? "Non fourni"}</dd>
            </div>
          </dl>
          <div className="button-row">
            {log.actorUserId && (
              <Link
                className="button button--secondary"
                href={`/admin/utilisateurs/${encodeURIComponent(log.actorUserId)}`}
              >
                <UserRound aria-hidden="true" /> Dossier de l’auteur
              </Link>
            )}
            {entityHref && (
              <Link className="button button--secondary" href={entityHref}>
                <ExternalLink aria-hidden="true" /> Ouvrir l’entité
              </Link>
            )}
          </div>
        </div>
        <div className="admin-audit-detail__diff">
          <article>
            <h2>Avant</h2>
            <pre>{safeJson(log.before)}</pre>
          </article>
          <article>
            <h2>Après</h2>
            <pre>{safeJson(log.after)}</pre>
          </article>
          <article className="admin-audit-detail__metadata">
            <h2>Métadonnées</h2>
            <pre>{safeJson(log.metadata)}</pre>
          </article>
        </div>
      </section>
    </>
  );
}
