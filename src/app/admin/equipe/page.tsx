import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BookCheck,
  CalendarDays,
  Clock3,
  FileCheck2,
  ListChecks,
  MessageCircleMore,
  ScrollText,
  Send,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";

import { formatActivityAction } from "@/components/admin/admin-activity-utils";
import { AdminHeader } from "@/components/admin/admin-header";
import type { TeamActivitySummaryDto } from "@/components/admin/user-activity-types";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { RoleBadge } from "@/components/ui/role-badge";
import { EmptyState, ErrorState, StatusPill, formatDate } from "@/components/ui/states";
import { getOptionalCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Équipe & activité · Administration" };

const scopes = new Set(["all", "admins", "moderators"]);

function formatTeamDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default async function AdminTeamActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; scope?: string; includeOwner?: string }>;
}) {
  const params = await searchParams;
  const days = [7, 14, 30, 90].includes(Number(params.days)) ? Number(params.days) : 7;
  const scope = params.scope && scopes.has(params.scope) ? params.scope : "all";
  const includeOwner = params.includeOwner === "true";
  const [result, currentUser] = await Promise.all([
    serverApi<unknown>(
      `/api/admin/team-activity?days=${days}&scope=${encodeURIComponent(scope)}&includeOwner=${includeOwner}&limit=100&offset=0`,
    ),
    getOptionalCurrentUser(),
  ]);
  const activity = unwrapObject<TeamActivitySummaryDto>(result.data);

  if (result.error || !activity) {
    return (
      <>
        <AdminHeader
          eyebrow="Pilotage interne"
          title="Équipe & activité"
          description="Suivi limité aux actions réalisées dans PokéTerps."
        />
        <ErrorState
          title="Activité d’équipe inaccessible"
          message={result.error ?? "Aucune donnée d’équipe n’a été renvoyée."}
          retryHref="/admin/equipe"
        />
      </>
    );
  }

  const stats = [
    ["Équipe active (7 j)", activity.activeStaff7d, UsersRound],
    ["Administrateurs actifs (7 j)", activity.activeAdmins7d, ShieldCheck],
    ["Modérateurs actifs (7 j)", activity.activeModerators7d, UsersRound],
    ["Sessions", activity.sessions, Clock3],
    ["Temps actif", formatTeamDuration(activity.activeDurationSeconds), CalendarDays],
    ["Actions", activity.actions, ListChecks],
    ["Actions sur 30 jours", activity.actions30d, Activity],
    ["Fiches modérées", activity.entriesModerated, FileCheck2],
    ["Avis modérés", activity.reviewsModerated, BookCheck],
    ["Messages traités", activity.messagesHandled, MessageCircleMore],
    ["Actions concours", activity.contestActions, Trophy],
    ["Messages Telegram", activity.telegramMessagesSent, Send],
  ] as const;
  return (
    <>
      <AdminHeader
        eyebrow={`Activité PokéTerps · ${activity.periodDays} jours`}
        title="Équipe & activité"
        description="Mesure les sessions et actions effectuées dans la Mini App, le site, le bot et la console. Aucune présence Telegram externe n’est utilisée."
        actions={
          activity.permissions.VIEW_TEAM_AUDIT_LOG ? (
            <Link className="button button--secondary" href="/admin/journal">
              <ScrollText aria-hidden="true" /> Journal complet
            </Link>
          ) : undefined
        }
      />

      <form className="content-panel admin-team-filters" action="/admin/equipe" method="get">
        <div className="field">
          <label htmlFor="team-period">
            <CalendarDays aria-hidden="true" /> Période
          </label>
          <select id="team-period" name="days" defaultValue={String(days)}>
            <option value="7">7 jours</option>
            <option value="14">14 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="team-scope">
            <ShieldCheck aria-hidden="true" /> Équipe visible
          </label>
          <select id="team-scope" name="scope" defaultValue={scope}>
            <option value="all">Tous mes accès</option>
            {activity.permissions.VIEW_ADMIN_ACTIVITY && (
              <option value="admins">Propriétaires & administrateurs</option>
            )}
            {activity.permissions.VIEW_MODERATOR_ACTIVITY && (
              <option value="moderators">Modérateurs</option>
            )}
          </select>
        </div>
        <button className="button" type="submit">
          Appliquer
        </button>
        {currentUser?.role === "OWNER" && (
          <label className="admin-team-owner-toggle">
            <input
              type="checkbox"
              name="includeOwner"
              value="true"
              defaultChecked={activity.ownerIncluded}
            />
            Inclure mes actions OWNER
          </label>
        )}
      </form>

      <section
        className="admin-team-stat-grid"
        aria-label={`Statistiques sur ${activity.periodDays} jours`}
      >
        {stats.map(([label, value, Icon]) => (
          <article key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="content-panel admin-team-members">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Comparaison interne</p>
            <h2>Membres de l’équipe</h2>
            <p>Les chiffres représentent uniquement les actions PokéTerps de la période.</p>
          </div>
          <UsersRound aria-hidden="true" />
        </header>
        {activity.members.length ? (
          <div className="admin-team-member-list">
            {activity.members.map((member) => (
              <article key={member.id}>
                <div className="admin-team-member__identity">
                  <span className="avatar" aria-hidden="true">
                    {member.displayName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <Link href={`/admin/utilisateurs/${encodeURIComponent(member.id)}`}>
                      {member.displayName}
                    </Link>
                    <RoleBadge role={member.role} compact />
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Sessions</dt>
                    <dd>{member.sessions7d}</dd>
                  </div>
                  <div>
                    <dt>Jours actifs</dt>
                    <dd>{member.activeDays7d}</dd>
                  </div>
                  <div>
                    <dt>Actions</dt>
                    <dd>{member.actions7d}</dd>
                  </div>
                  <div>
                    <dt>Temps actif</dt>
                    <dd>{formatTeamDuration(member.activeDurationSeconds)}</dd>
                  </div>
                  <div>
                    <dt>Fiches</dt>
                    <dd>{member.entriesModerated7d}</dd>
                  </div>
                  <div>
                    <dt>Avis</dt>
                    <dd>{member.reviewsModerated7d}</dd>
                  </div>
                  <div>
                    <dt>Messages</dt>
                    <dd>{member.messagesHandled7d}</dd>
                  </div>
                </dl>
                <small>Dernière activité : {formatDate(member.lastSeenAt)}</small>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aucune activité d’équipe"
            description="Aucune action n’est enregistrée pour cette période et ce périmètre."
          />
        )}
      </section>

      {activity.permissions.VIEW_TEAM_AUDIT_LOG && (
        <section className="content-panel admin-team-audit-preview">
          <header className="section-heading">
            <div>
              <p className="eyebrow">Dernières actions</p>
              <h2>Flux d’activité</h2>
            </div>
            <Activity aria-hidden="true" />
          </header>
          {activity.recentAudit.length ? (
            <div className="admin-team-audit-list">
              {activity.recentAudit.map((item) => (
                <Link href={`/admin/journal/${encodeURIComponent(item.id)}`} key={item.id}>
                  <span className="admin-team-audit__icon">
                    <Activity aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{formatActivityAction(item.action)}</strong>
                    <small>
                      {item.actorName ?? "Système"} · {formatDate(item.createdAt)}
                    </small>
                  </span>
                  <StatusPill value={item.source} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Aucune action récente"
              description="Le flux se remplira avec les prochaines actions internes."
            />
          )}
        </section>
      )}
    </>
  );
}
