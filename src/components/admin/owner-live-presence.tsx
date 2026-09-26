"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, RefreshCw, Smartphone } from "lucide-react";

import type {
  LivePresenceUserDto,
  OwnerLivePresenceDto,
} from "@/components/admin/user-activity-types";
import { UserAvatar } from "@/components/ui/user-avatar";

function activityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "heure inconnue";
  return new Intl.DateTimeFormat("fr-CH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function PresenceList({ users, empty }: { users: LivePresenceUserDto[]; empty: string }) {
  if (!users.length) return <p className="owner-presence__empty">{empty}</p>;

  return (
    <div className="owner-presence__list">
      {users.map((user) => (
        <article className="owner-presence__user" key={user.id}>
          <UserAvatar displayName={user.displayName} src={user.profilePhotoUrl} />
          <div>
            <strong>{user.displayName}</strong>
            {user.telegramUsername && <span>@{user.telegramUsername}</span>}
            <small>Dernière activité à {activityTime(user.lastActivityAt)}</small>
          </div>
          <span className="owner-presence__dot" aria-label="Actif" />
        </article>
      ))}
    </div>
  );
}

export function OwnerLivePresence({ initial }: { initial: OwnerLivePresenceDto }) {
  const [presence, setPresence] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/live-presence", { cache: "no-store" });
      if (response.ok) {
        const body = (await response.json()) as { data?: OwnerLivePresenceDto };
        if (body.data) setPresence(body.data);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [refresh]);

  return (
    <section className="content-panel owner-live-presence" aria-labelledby="owner-presence-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Propriétaire uniquement</p>
          <h2 id="owner-presence-title">Qui est connecté maintenant ?</h2>
          <p>
            Mini App : dernières activités sur 5 minutes · Bot : interactions récentes sur 10
            minutes. Les mêmes personnes peuvent apparaître dans les deux listes.
          </p>
        </div>
        <button
          className="button button--secondary owner-presence__refresh"
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label="Actualiser la présence"
        >
          <RefreshCw aria-hidden="true" className={refreshing ? "is-spinning" : undefined} />
          Actualiser
        </button>
      </header>
      <div className="owner-presence__grid">
        <section>
          <h3>
            <Smartphone aria-hidden="true" /> Mini App <span>{presence.miniApp.length}</span>
          </h3>
          <PresenceList
            users={presence.miniApp}
            empty="Aucun utilisateur actif récemment dans la Mini App."
          />
        </section>
        <section>
          <h3>
            <Bot aria-hidden="true" /> Bot Telegram <span>{presence.bot.length}</span>
          </h3>
          <PresenceList users={presence.bot} empty="Aucune interaction récente avec le bot." />
        </section>
      </div>
      <small className="owner-presence__updated">
        Dernière vérification : {activityTime(presence.generatedAt)}
      </small>
    </section>
  );
}
