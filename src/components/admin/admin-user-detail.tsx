"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Clock3,
  FileClock,
  Flag,
  Heart,
  KeyRound,
  MessageCircleMore,
  NotebookPen,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Star,
  Trophy,
  UserRoundCog,
} from "lucide-react";

import {
  activityCategories,
  activityCategory,
  activityEntityHref,
  formatActivityAction,
  roleLabels,
  sessionState,
} from "@/components/admin/admin-activity-utils";
import { UserAdminActions } from "@/components/admin/user-admin-actions";
import type {
  AdminUserDetailDto,
  TeamPermissionDto,
  TelegramDirectMessageDto,
  UserInternalNoteDto,
} from "@/components/admin/user-activity-types";
import { submitJson } from "@/components/forms/form-api";
import { RoleBadge } from "@/components/ui/role-badge";
import { EmptyState, StatusPill } from "@/components/ui/states";
import { UserAvatar } from "@/components/ui/user-avatar";

function formatDateTime(value?: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} j ${hours % 24} h`;
  }
  return `${hours} h ${minutes % 60} min`;
}

function platformLabel(value: string) {
  const labels: Record<string, string> = {
    MINI_APP: "Mini App Telegram",
    WEB: "Site web",
    TELEGRAM_BOT: "Bot Telegram",
    ADMIN_WEB: "Console d’administration",
    UNKNOWN: "Accès PokéTerps",
  };
  return labels[value] ?? value;
}

export function AdminUserDetail({ initialDetail }: { initialDetail: AdminUserDetailDto }) {
  const [notes, setNotes] = useState(initialDetail.notes);
  const [messages, setMessages] = useState(initialDetail.telegramMessages);
  const [teamPermissions, setTeamPermissions] = useState(initialDetail.teamPermissions);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const [activityFilter, setActivityFilter] = useState<(typeof activityCategories)[number]>("Tout");
  const [visibleActivityCount, setVisibleActivityCount] = useState(20);
  const { user, stats } = initialDetail;
  const filteredActivity = initialDetail.activity.filter(
    (event) => activityFilter === "Tout" || activityCategory(event.eventType) === activityFilter,
  );
  const visibleActivity = filteredActivity.slice(0, visibleActivityCount);
  const activitySummary = initialDetail.activity.reduce<Record<string, number>>(
    (summary, event) => {
      const category = activityCategory(event.eventType);
      summary[category] = (summary[category] ?? 0) + 1;
      return summary;
    },
    {},
  );

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("note");
    setFeedback("");
    const result = await submitJson<UserInternalNoteDto>(
      `/api/admin/users/${encodeURIComponent(user.id)}/notes`,
      "POST",
      { content: note },
    );
    setPending("");
    if (!result.ok || !result.data) {
      setFeedback(result.message);
      return;
    }
    setNotes((current) => [result.data!, ...current]);
    setNote("");
    setFeedback("Note interne ajoutée au dossier.");
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Envoyer ce message privé via le bot Telegram ?")) return;
    setPending("message");
    setFeedback("");
    const result = await submitJson<Partial<TelegramDirectMessageDto>>(
      `/api/admin/users/${encodeURIComponent(user.id)}/telegram-message`,
      "POST",
      { text: message },
    );
    setPending("");
    if (!result.ok || !result.data) {
      setFeedback(result.message);
      return;
    }
    setMessages((current) => [
      {
        id: result.data!.id ?? crypto.randomUUID(),
        text: message,
        status: result.data!.status ?? "SENT",
        telegramMessageId: result.data!.telegramMessageId ?? null,
        errorMessage: null,
        adminId: result.data!.adminId ?? "",
        adminName: result.data!.adminName ?? "Équipe PokéTerps",
        createdAt: new Date().toISOString(),
        sentAt: result.data!.sentAt ?? new Date().toISOString(),
      },
      ...current,
    ]);
    setMessage("");
    setFeedback("Message Telegram envoyé et archivé.");
  }

  async function setTeamPermission(
    permissionCode: TeamPermissionDto["permissionCode"],
    isGranted: boolean | null,
  ) {
    if (!window.confirm("Confirmer ce niveau d’accès à l’activité de l’équipe ?")) return;
    const pendingKey = `permission-${permissionCode}`;
    setPending(pendingKey);
    setFeedback("");
    const result = await submitJson<TeamPermissionDto>(
      `/api/admin/users/${encodeURIComponent(user.id)}/permissions`,
      "PUT",
      { permissionCode, isGranted, expiresAt: null },
    );
    setPending("");
    if (!result.ok || !result.data) {
      setFeedback(result.message);
      return;
    }
    setTeamPermissions((current) =>
      current.map((permission) =>
        permission.permissionCode === permissionCode ? result.data! : permission,
      ),
    );
    setFeedback("Permission d’équipe mise à jour et auditée.");
  }

  const statCards = [
    ["Sessions (7 j)", stats.sessions7d, Smartphone],
    ["Jours actifs (7 j)", stats.activeDays7d, CalendarClock],
    ["Actions PokéTerps (7 j)", stats.actions7d, Activity],
    ["Sessions (30 j)", stats.sessions30d, Smartphone],
    ["Jours actifs (30 j)", stats.activeDays30d, CalendarClock],
    ["Actions PokéTerps (30 j)", stats.actions30d, Activity],
    ["Sessions totales", stats.sessionsTotal, Clock3],
    ["Durée totale", formatDuration(stats.sessionDurationTotalSeconds), CalendarClock],
    ["Niveau", user.level, Trophy],
    ["Expérience", `${user.experiencePoints} XP`, Star],
    ["Messages équipe", stats.telegramMessagesSent, Send],
  ] as const;

  const decisionCards = [
    ["Fiches approuvées", stats.entryApprovals30d, ShieldCheck],
    ["Fiches refusées", stats.entryRejections30d, ShieldAlert],
    ["Avis approuvés", stats.reviewApprovals30d, ShieldCheck],
    ["Avis refusés", stats.reviewRejections30d, ShieldAlert],
    ["Décisions concours", stats.contestDecisions30d, Trophy],
    ["Sanctions décidées", stats.sanctions30d, Flag],
  ] as const;

  const contributionCards = [
    ["Fiches créées", stats.entriesCreated, FileClock],
    ["Fiches soumises", stats.entriesSubmitted, FileClock],
    ["Fiches validées", stats.entriesApproved, ShieldCheck],
    ["Fiches refusées", stats.entriesRejected, ShieldAlert],
    ["Avis soumis", stats.reviewsSubmitted, MessageCircleMore],
    ["Avis validés", stats.reviewsApproved, ShieldCheck],
    ["Avis refusés", stats.reviewsRejected, ShieldAlert],
    ["J’aime donnés", stats.likesGiven, Heart],
    ["J’aime reçus", stats.likesReceived, Heart],
    ["Favoris enregistrés", stats.favoritesSaved, Star],
    ["Favoris reçus", stats.favoritesReceived, Star],
    ["Vues reçues", stats.viewsReceived, Activity],
    ["Messages envoyés", stats.messagesSent, Send],
    ["Signalements", stats.reportsSent, Flag],
    ["Participations concours", stats.contestParticipations, Trophy],
    ["Fiches modérées", stats.entriesModerated, ShieldCheck],
    ["Avis modérés", stats.reviewsModerated, MessageCircleMore],
    ["Concours modérés", stats.contestsModerated, ShieldAlert],
  ] as const;

  const rankingCards = [
    ["Cette semaine", initialDetail.rankings.weekly],
    ["Ce mois", initialDetail.rankings.monthly],
    ["Général", initialDetail.rankings.general],
    ["Par captures", initialDetail.rankings.captures],
  ] as const;

  return (
    <div className="admin-user-detail page-stack">
      <section className="content-panel admin-user-identity">
        <UserAvatar
          className="admin-user-identity__avatar"
          displayName={user.displayName}
          src={user.profilePhotoUrl}
          eager
        />
        <div className="admin-user-identity__copy">
          <p className="eyebrow">Dossier interne PokéTerps</p>
          <h2>{user.displayName}</h2>
          <div className="button-row">
            <RoleBadge role={user.role} compact />
            <StatusPill value={user.isBanned ? "BANNED" : "ACTIVE"} />
            {user.telegramUsername && <span>@{user.telegramUsername}</span>}
          </div>
          <p>
            Première interaction PokéTerps connue : {formatDateTime(user.firstInteractionAt)} ·
            dernière activité : {formatDateTime(user.lastSeenAt)}
          </p>
          <p>Nomination au rôle actuel : {formatDateTime(user.appointedAt)}</p>
          {user.telegramId !== undefined && (
            <p className="admin-user-telegram-id">
              ID Telegram : <code>{user.telegramId ?? "non disponible"}</code> · visible uniquement
              par le propriétaire
            </p>
          )}
        </div>
        {user.publicSlug && (
          <Link
            className="button button--secondary"
            href={`/profil/${encodeURIComponent(user.publicSlug)}`}
          >
            Voir le profil public
          </Link>
        )}
      </section>

      <section className="admin-user-stat-grid" aria-label="Statistiques du compte">
        {statCards.map(([label, value, Icon]) => (
          <article key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="content-panel admin-user-contributions">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Contributions détaillées</p>
            <h2>Activité communautaire</h2>
            <p>Compteurs internes PokéTerps, sans activité Telegram extérieure.</p>
          </div>
          <BarChart3 aria-hidden="true" />
        </header>
        <div className="admin-user-contribution-grid">
          {contributionCards.map(([label, value, Icon]) => (
            <article key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel admin-user-decisions">
        <header className="section-heading">
          <div>
            <p className="eyebrow">30 derniers jours</p>
            <h2>Décisions d’équipe</h2>
            <p>Compteurs de décisions réalisées dans PokéTerps, sans suivi externe.</p>
          </div>
          <ShieldCheck aria-hidden="true" />
        </header>
        <div className="admin-user-contribution-grid">
          {decisionCards.map(([label, value, Icon]) => (
            <article key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel admin-user-rankings">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Position publique</p>
            <h2>Classements</h2>
            <p>Un compte non éligible au classement public apparaît comme non classé.</p>
          </div>
          <Trophy aria-hidden="true" />
        </header>
        <div className="admin-user-ranking-grid">
          {rankingCards.map(([label, rank]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{rank === null ? "—" : `#${rank}`}</strong>
            </article>
          ))}
        </div>
      </section>

      {initialDetail.canManageAccount && (
        <section className="content-panel admin-user-access-panel">
          <header className="section-heading">
            <div>
              <p className="eyebrow">Accès et sanction</p>
              <h2>Rôle du compte</h2>
              <p>Toute modification est historisée avec son motif et son auteur.</p>
            </div>
            <UserRoundCog aria-hidden="true" />
          </header>
          <UserAdminActions
            userId={user.id}
            role={user.role}
            isBanned={user.isBanned}
            suspensionReason={user.suspensionReason}
            suspensionUntil={user.suspensionUntil}
          />
          {initialDetail.canManageTeamPermissions && (
            <div className="admin-team-permission-editor">
              <header>
                <div>
                  <h3>Délégation de l’activité d’équipe</h3>
                  <p>
                    Le propriétaire peut conserver le rôle par défaut, autoriser ou refuser chaque
                    accès.
                  </p>
                </div>
                <KeyRound aria-hidden="true" />
              </header>
              <div className="admin-team-permission-list">
                {teamPermissions.map((permission) => (
                  <article key={permission.permissionCode}>
                    <div>
                      <strong>{teamPermissionLabel(permission.permissionCode)}</strong>
                      <span>
                        Accès effectif : {permission.effective ? "autorisé" : "refusé"}
                        {permission.expiresAt
                          ? ` · jusqu’au ${formatDateTime(permission.expiresAt)}`
                          : ""}
                      </span>
                    </div>
                    <div className="button-row">
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={
                          pending === `permission-${permission.permissionCode}` ||
                          permission.override === null
                        }
                        onClick={() => void setTeamPermission(permission.permissionCode, null)}
                      >
                        Par défaut
                      </button>
                      <button
                        className="button button--screen"
                        type="button"
                        disabled={
                          pending === `permission-${permission.permissionCode}` ||
                          permission.override === true
                        }
                        onClick={() => void setTeamPermission(permission.permissionCode, true)}
                      >
                        Autoriser
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        disabled={
                          pending === `permission-${permission.permissionCode}` ||
                          permission.override === false
                        }
                        onClick={() => void setTeamPermission(permission.permissionCode, false)}
                      >
                        Refuser
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {initialDetail.canManageAccount && (
        <div className="admin-user-editor-grid">
          <section className="content-panel">
            <header className="section-heading">
              <div>
                <p className="eyebrow">Équipe uniquement</p>
                <h2>Ajouter une note</h2>
              </div>
              <NotebookPen aria-hidden="true" />
            </header>
            <form className="admin-action-stack" onSubmit={addNote}>
              <div className="field">
                <label htmlFor="admin-user-note">Observation interne</label>
                <textarea
                  id="admin-user-note"
                  required
                  minLength={2}
                  maxLength={5000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <small>Jamais visible par l’utilisateur.</small>
              </div>
              <button className="button button--dark" type="submit" disabled={pending === "note"}>
                <NotebookPen aria-hidden="true" />{" "}
                {pending === "note" ? "Ajout…" : "Ajouter au dossier"}
              </button>
            </form>
          </section>

          <section className="content-panel">
            <header className="section-heading">
              <div>
                <p className="eyebrow">Message privé historisé</p>
                <h2>Écrire sur Telegram</h2>
              </div>
              <Send aria-hidden="true" />
            </header>
            <form className="admin-action-stack" onSubmit={sendMessage}>
              <div className="field">
                <label htmlFor="admin-user-telegram-message">Message du bot PokéTerps</label>
                <textarea
                  id="admin-user-telegram-message"
                  required
                  maxLength={4096}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <small>{message.length}/4096 · aucun identifiant Telegram n’est affiché.</small>
              </div>
              <button className="button" type="submit" disabled={pending === "message"}>
                <Send aria-hidden="true" />{" "}
                {pending === "message" ? "Envoi…" : "Envoyer et archiver"}
              </button>
            </form>
          </section>
        </div>
      )}

      {feedback && (
        <p className="admin-action-feedback" role="status">
          {feedback}
        </p>
      )}

      <section className="content-panel admin-user-timeline">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Mini App, web et bot</p>
            <h2>Sessions PokéTerps</h2>
            <p>Aucune activité Telegram extérieure à l’application n’est collectée.</p>
          </div>
          <Clock3 aria-hidden="true" />
        </header>
        <div className="admin-session-overview">
          <article>
            <span>Total</span>
            <strong>{stats.sessionsTotal}</strong>
          </article>
          <article>
            <span>Durée cumulée</span>
            <strong>{formatDuration(stats.sessionDurationTotalSeconds)}</strong>
          </article>
          <article>
            <span>Durée moyenne</span>
            <strong>{formatDuration(stats.sessionDurationAverageSeconds)}</strong>
          </article>
        </div>
        {stats.sessionPlatforms.length > 0 && (
          <div className="admin-session-platforms" aria-label="Répartition des plateformes">
            {stats.sessionPlatforms.map((platform) => (
              <article key={platform.platform}>
                <strong>{platformLabel(platform.platform)}</strong>
                <span>
                  {platform.sessions} session{platform.sessions > 1 ? "s" : ""} ·{" "}
                  {formatDuration(platform.durationSeconds)}
                </span>
              </article>
            ))}
          </div>
        )}
        {initialDetail.sessions.length ? (
          <div className="admin-session-list">
            {initialDetail.sessions.map((session) => (
              <article key={session.id}>
                <Smartphone aria-hidden="true" />
                <div>
                  <strong>{platformLabel(session.platform)}</strong>
                  <span>{formatDateTime(session.startedAt)}</span>
                </div>
                <div>
                  <StatusPill value={sessionState(session.endedAt)} />
                  <span>{formatDuration(session.durationSeconds)}</span>
                  <small>
                    {session.actionCount} action{session.actionCount > 1 ? "s" : ""}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aucune session enregistrée"
            description="Les prochaines ouvertures PokéTerps apparaîtront ici."
          />
        )}
      </section>

      <div className="admin-user-history-grid">
        <HistorySection
          title="Activité PokéTerps"
          eyebrow="100 derniers événements"
          icon={<Activity aria-hidden="true" />}
          empty="Aucune activité enregistrée."
        >
          <div className="admin-activity-summary" aria-label="Résumé des événements">
            <strong>{initialDetail.activity.length} actions</strong>
            <span>{activitySummary.Avis ?? 0} avis</span>
            <span>{activitySummary.Fiches ?? 0} fiches</span>
            <span>{activitySummary.Messages ?? 0} messages</span>
            <span>
              {initialDetail.activity.length -
                (activitySummary.Avis ?? 0) -
                (activitySummary.Fiches ?? 0) -
                (activitySummary.Messages ?? 0)}{" "}
              autres
            </span>
          </div>
          <div className="admin-activity-tabs" role="tablist" aria-label="Type d’activité">
            {activityCategories.map((category) => (
              <button
                type="button"
                role="tab"
                aria-selected={activityFilter === category}
                key={category}
                onClick={() => {
                  setActivityFilter(category);
                  setVisibleActivityCount(20);
                }}
              >
                {category}
              </button>
            ))}
          </div>
          {visibleActivity.map((event) => {
            const href = activityEntityHref(event.entityType, event.entityId);
            return (
              <article className="admin-history-row" key={event.id}>
                <Activity aria-hidden="true" />
                <div>
                  <strong>{formatActivityAction(event.eventType, event.metadata)}</strong>
                  <span>{formatDateTime(event.createdAt)}</span>
                </div>
                {href && (
                  <Link className="text-link" href={href}>
                    Ouvrir
                  </Link>
                )}
              </article>
            );
          })}
          {filteredActivity.length === 0 && (
            <EmptyState
              title="Aucun événement dans cette catégorie"
              description="Choisis un autre onglet pour consulter l’activité disponible."
            />
          )}
          {visibleActivityCount < filteredActivity.length && (
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setVisibleActivityCount((count) => Math.min(count + 20, 100))}
            >
              Charger 20 événements de plus
            </button>
          )}
        </HistorySection>
        <HistorySection
          title="Notes internes"
          eyebrow="Suivi de l’équipe"
          icon={<NotebookPen aria-hidden="true" />}
          empty="Aucune note interne."
        >
          {notes.map((item) => (
            <article className="admin-history-note" key={item.id}>
              <p>{item.content}</p>
              <footer>
                {item.adminName ?? "Équipe"} · {formatDateTime(item.createdAt)}
              </footer>
            </article>
          ))}
        </HistorySection>
        <HistorySection
          title="Historique des rôles"
          eyebrow="Traçabilité"
          icon={<UserRoundCog aria-hidden="true" />}
          empty="Aucun changement de rôle."
        >
          {initialDetail.roleHistory.map((item) => (
            <article className="admin-history-row" key={item.id}>
              <UserRoundCog aria-hidden="true" />
              <div>
                <strong>
                  {item.previousRole ? `${roleLabels[item.previousRole]} → ` : "Attribution : "}
                  {roleLabels[item.newRole]}
                </strong>
                <span>
                  {item.changedByName ?? "Système"} · {formatDateTime(item.createdAt)}
                </span>
                {item.reason && <p>{item.reason}</p>}
              </div>
            </article>
          ))}
        </HistorySection>
        <HistorySection
          title="Sanctions"
          eyebrow="Bans et réactivations"
          icon={<ShieldAlert aria-hidden="true" />}
          empty="Aucune sanction."
        >
          {initialDetail.sanctions.map((item) => (
            <article className="admin-history-row" key={item.id}>
              <ShieldAlert aria-hidden="true" />
              <div>
                <strong>
                  {item.action === "BAN"
                    ? "Suspension"
                    : item.action === "UNBAN"
                      ? "Réactivation"
                      : "Avertissement"}
                </strong>
                <span>
                  {item.adminName ?? "Équipe"} · {formatDateTime(item.createdAt)}
                </span>
                <p>
                  {item.reason}
                  {item.endsAt ? ` · jusqu’au ${formatDateTime(item.endsAt)}` : ""}
                </p>
              </div>
            </article>
          ))}
        </HistorySection>
        <HistorySection
          title="Messages Telegram"
          eyebrow="Historique privé"
          icon={<Send aria-hidden="true" />}
          empty="Aucun message envoyé par l’équipe."
        >
          {messages.map((item) => (
            <article className="admin-history-note" key={item.id}>
              <div className="button-row">
                <StatusPill value={item.status} />
                <span>{formatDateTime(item.sentAt ?? item.createdAt)}</span>
              </div>
              <p>{item.text}</p>
              <footer>
                {item.adminName ?? "Équipe PokéTerps"}
                {item.errorMessage ? ` · ${item.errorMessage}` : ""}
              </footer>
            </article>
          ))}
        </HistorySection>
      </div>
    </div>
  );
}

function teamPermissionLabel(value: TeamPermissionDto["permissionCode"]) {
  const labels: Record<TeamPermissionDto["permissionCode"], string> = {
    VIEW_ADMIN_ACTIVITY: "Voir l’activité des administrateurs",
    VIEW_MODERATOR_ACTIVITY: "Voir l’activité des modérateurs",
    VIEW_TEAM_AUDIT_LOG: "Voir le journal détaillé de l’équipe",
  };
  return labels[value];
}

function HistorySection({
  title,
  eyebrow,
  icon,
  empty,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="content-panel admin-user-history">
      <header className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {icon}
      </header>
      {children.length ? (
        <div className="admin-user-history__list">{children}</div>
      ) : (
        <EmptyState
          title={empty}
          description="L’historique se remplira avec les actions PokéTerps."
        />
      )}
    </section>
  );
}
