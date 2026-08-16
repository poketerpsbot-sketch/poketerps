import "server-only";

import { getSqlClient } from "@/lib/db";
import { getEnv } from "@/lib/env";

type HealthRow = {
  last_update_received_at: string | null;
  last_update_processed_at: string | null;
  update_errors_24h: number | string;
  average_latency_ms: number | string;
  last_message_sent_at: string | null;
  failed_deliveries_24h: number | string;
  queued_deliveries: number | string;
  failed_publications_24h: number | string;
  published_24h: number | string;
};

type AlertRow = { kind: string; total: number | string; window_minutes: number | string };

export async function getAdminSystemHealth() {
  const env = getEnv();
  const [health] = await getSqlClient()<HealthRow[]>`
    select
      (select max(received_at) from telegram_update_receipts) last_update_received_at,
      (select max(processed_at) from telegram_update_receipts) last_update_processed_at,
      (select count(*) from telegram_update_receipts
        where received_at>=now()-interval '24 hours' and status='FAILED')::bigint update_errors_24h,
      (select coalesce(avg(extract(epoch from (processed_at-received_at))*1000),0)
        from telegram_update_receipts where received_at>=now()-interval '24 hours'
          and processed_at is not null and processed_at>=received_at)::bigint average_latency_ms,
      (select max(sent_at) from admin_outbound_messages where status='SENT') last_message_sent_at,
      (select count(*) from admin_outbound_messages
        where created_at>=now()-interval '24 hours' and status='FAILED')::bigint failed_deliveries_24h,
      (select count(*) from admin_outbound_messages where status='QUEUED')::bigint queued_deliveries,
      (select count(*) from telegram_publications
        where updated_at>=now()-interval '24 hours' and status='FAILED')::bigint failed_publications_24h,
      (select count(*) from telegram_publications
        where published_at>=now()-interval '24 hours' and status='PUBLISHED')::bigint published_24h
  `;
  const alerts = await getSqlClient()<AlertRow[]>`
    with sensitive as (
      select case
        when action ilike '%DELETE%' then 'Suppressions'
        when action ilike '%BAN%' then 'Bannissements'
        when action ilike '%ROLE%' or action ilike '%PERMISSION%' then 'Rôles et permissions'
        when action ilike '%REJECT%' then 'Refus'
        else null end kind
      from audit_logs where created_at>=now()-interval '30 minutes'
    )
    select kind,count(*)::bigint total,30::int window_minutes from sensitive
    where kind is not null group by kind
    having (kind='Suppressions' and count(*)>=10)
      or (kind='Refus' and count(*)>=20)
      or (kind in ('Bannissements','Rôles et permissions') and count(*)>=5)
    order by total desc
  `;
  return {
    telegram: {
      configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET),
      webhookUrl: `${env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook`,
      lastUpdateReceivedAt: health?.last_update_received_at ?? null,
      lastUpdateProcessedAt: health?.last_update_processed_at ?? null,
      updateErrors24h: Number(health?.update_errors_24h ?? 0),
      averageLatencyMs: Number(health?.average_latency_ms ?? 0),
      lastMessageSentAt: health?.last_message_sent_at ?? null,
      failedDeliveries24h: Number(health?.failed_deliveries_24h ?? 0),
      queuedDeliveries: Number(health?.queued_deliveries ?? 0),
      failedPublications24h: Number(health?.failed_publications_24h ?? 0),
      published24h: Number(health?.published_24h ?? 0),
    },
    alerts: alerts.map((alert) => ({
      kind: alert.kind,
      total: Number(alert.total),
      windowMinutes: Number(alert.window_minutes),
    })),
  };
}
