import "server-only";

import { getDb, getSqlClient } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditEvent = {
  actorUserId?: string | null;
  actorTelegramIdSnapshot?: number | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  source?: "WEB" | "TELEGRAM" | "SYSTEM";
  requestId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

export function auditValues(event: AuditEvent): typeof auditLogs.$inferInsert {
  return {
    actorUserId: event.actorUserId ?? null,
    actorTelegramIdSnapshot: event.actorTelegramIdSnapshot ?? null,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    source: event.source ?? "WEB",
    requestId: event.requestId ?? null,
    beforeData: event.before,
    afterData: event.after,
    metadata: event.metadata ?? {},
  };
}

export async function recordAudit(event: AuditEvent): Promise<void> {
  await getDb().insert(auditLogs).values(auditValues(event));
}

export async function listAuditLogs(query: {
  limit: number;
  offset: number;
  entityType?: string;
  action?: string;
}) {
  const entityType = query.entityType ?? null;
  const action = query.action ?? null;
  const rows = await getSqlClient()<
    Array<{
      id: string;
      actor_user_id: string | null;
      actor_name: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      source: string;
      request_id: string | null;
      before_data: unknown;
      after_data: unknown;
      metadata: Record<string, unknown>;
      created_at: Date;
      total_count: number;
    }>
  >`
    select a.id, a.actor_user_id, u.display_name as actor_name, a.action, a.entity_type,
      a.entity_id, a.source::text, a.request_id, a.before_data, a.after_data, a.metadata,
      a.created_at, count(*) over()::int as total_count
    from audit_logs a
    left join users u on u.id = a.actor_user_id
    where (${entityType}::text is null or a.entity_type = ${entityType})
      and (${action}::text is null or a.action = ${action})
    order by a.created_at desc
    limit ${query.limit} offset ${query.offset}
  `;
  return {
    logs: rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actorName: row.actor_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      source: row.source,
      requestId: row.request_id,
      before: row.before_data,
      after: row.after_data,
      metadata: row.metadata,
      createdAt: row.created_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
  };
}
