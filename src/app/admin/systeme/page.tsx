import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlertTriangle, Bot, Radio, Send, ShieldCheck } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { serverApi } from "@/components/data/server-api";
import { ErrorState, formatDate } from "@/components/ui/states";

export const metadata: Metadata = { title: "Santé système · Administration" };

type SystemHealth = {
  telegram: {
    configured: boolean;
    webhookUrl: string;
    lastUpdateReceivedAt: string | null;
    lastUpdateProcessedAt: string | null;
    updateErrors24h: number;
    averageLatencyMs: number;
    lastMessageSentAt: string | null;
    failedDeliveries24h: number;
    queuedDeliveries: number;
    failedPublications24h: number;
    published24h: number;
  };
  alerts: Array<{ kind: string; total: number; windowMinutes: number }>;
};

export default async function AdminSystemPage() {
  const result = await serverApi<SystemHealth>("/api/admin/system-health");
  if (result.error || !result.data) {
    return (
      <ErrorState
        message={result.error ?? "Santé système indisponible."}
        retryHref="/admin/systeme"
      />
    );
  }
  const { telegram, alerts } = result.data;
  return (
    <>
      <AdminHeader
        eyebrow="Centre de contrôle Owner"
        title="Santé système"
        description="Surveille Telegram, les livraisons et les actions inhabituelles sans exposer de secret."
      />
      <section className="admin-stat-grid" aria-label="Santé Telegram">
        <HealthStat
          icon={<ShieldCheck aria-hidden="true" />}
          label="Configuration"
          value={telegram.configured ? "Prête" : "Incomplète"}
        />
        <HealthStat
          icon={<Radio aria-hidden="true" />}
          label="Dernier update"
          value={
            telegram.lastUpdateReceivedAt ? formatDate(telegram.lastUpdateReceivedAt) : "Jamais"
          }
        />
        <HealthStat
          icon={<Bot aria-hidden="true" />}
          label="Latence 24 h"
          value={`${telegram.averageLatencyMs} ms`}
        />
        <HealthStat
          icon={<Send aria-hidden="true" />}
          label="Dernier message"
          value={telegram.lastMessageSentAt ? formatDate(telegram.lastMessageSentAt) : "Jamais"}
        />
      </section>
      <section className="content-panel page-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Telegram</p>
            <h2>Livraisons sur 24 heures</h2>
          </div>
        </div>
        <div className="admin-attention-grid">
          <Metric label="Updates en erreur" value={telegram.updateErrors24h} danger />
          <Metric label="Messages échoués" value={telegram.failedDeliveries24h} danger />
          <Metric label="Messages en file" value={telegram.queuedDeliveries} />
          <Metric label="Publications réussies" value={telegram.published24h} />
          <Metric label="Publications échouées" value={telegram.failedPublications24h} danger />
        </div>
        <p className="muted">
          Webhook attendu : <code>{telegram.webhookUrl}</code>
        </p>
      </section>
      <section className="content-panel page-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Surveillance</p>
            <h2>Actions inhabituelles</h2>
          </div>
        </div>
        {alerts.length ? (
          alerts.map((alert) => (
            <div className="admin-system-alert" key={alert.kind}>
              <AlertTriangle aria-hidden="true" />
              <strong>{alert.kind}</strong>
              <span>
                {alert.total} actions en {alert.windowMinutes} min
              </span>
            </div>
          ))
        ) : (
          <p>Aucune activité anormale détectée sur les 30 dernières minutes.</p>
        )}
      </section>
    </>
  );
}

function HealthStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="admin-stat">
      <span>
        {icon} {label}
      </span>
      <strong>{value}</strong>
    </article>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={`admin-attention-link${danger && value ? " is-danger" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
