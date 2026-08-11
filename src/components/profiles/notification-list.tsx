"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, CheckCheck, MessageSquareText } from "lucide-react";

import type { UserNotificationDto } from "@/components/data/types";
import { submitJson } from "@/components/forms/form-api";
import { formatDate } from "@/components/ui/states";

function category(type: string): string {
  if (type.startsWith("REVIEW_")) return "AVIS";
  if (type.startsWith("ENTRY_")) return "FICHE";
  if (type === "CONTEST") return "CONCOURS";
  return "INFORMATION";
}

export function NotificationList({ initialItems }: { initialItems: UserNotificationDto[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  async function markRead(notificationId?: string) {
    const key = notificationId ?? "all";
    setPending(key);
    setFeedback("");
    const result = await submitJson(
      "/api/me/notifications",
      "PATCH",
      notificationId ? { notificationId } : { all: true },
    );
    setPending(null);
    if (!result.ok) {
      setFeedback(result.message);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        !notificationId || String(item.id) === notificationId ? { ...item, isRead: true } : item,
      ),
    );
  }

  return (
    <div className="notification-center">
      <div className="notification-center__toolbar">
        <p>
          <Bell size={17} aria-hidden="true" /> {unreadCount} notification
          {unreadCount > 1 ? "s" : ""} non lue{unreadCount > 1 ? "s" : ""}
        </p>
        {unreadCount > 0 && (
          <button
            className="button button--secondary"
            type="button"
            disabled={pending !== null}
            onClick={() => markRead()}
          >
            <CheckCheck size={16} aria-hidden="true" />
            {pending === "all" ? "Mise à jour…" : "Tout marquer comme lu"}
          </button>
        )}
      </div>

      <div className="notification-list">
        {items.map((item) => (
          <article
            className={`notification-card${item.isRead ? "" : " notification-card--unread"}`}
            key={String(item.id)}
          >
            <span className="notification-card__icon" aria-hidden="true">
              <MessageSquareText />
            </span>
            <div className="notification-card__copy">
              <div className="notification-card__heading">
                <span className="eyebrow">{category(item.type)}</span>
                {!item.isRead && <span className="notification-card__dot">Nouveau</span>}
              </div>
              <h2>{item.title}</h2>
              <p>{item.message}</p>
              <small>{formatDate(item.createdAt)}</small>
              <div className="button-row">
                {item.actionUrl && (
                  <Link className="button" href={item.actionUrl}>
                    {item.type === "REVIEW_CHANGES_REQUESTED"
                      ? "Modifier mon avis"
                      : item.type === "ENTRY_CHANGES_REQUESTED"
                        ? "Modifier ma fiche"
                        : "Voir le détail"}
                  </Link>
                )}
                {!item.isRead && (
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={pending !== null}
                    onClick={() => markRead(String(item.id))}
                  >
                    {pending === String(item.id) ? "Mise à jour…" : "Marquer comme lu"}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {feedback && (
        <p className="form-feedback form-feedback--error" role="alert">
          {feedback}
        </p>
      )}
    </div>
  );
}
