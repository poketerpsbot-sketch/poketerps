import type { Metadata } from "next";
import { BellRing } from "lucide-react";

import type { UserNotificationDto } from "@/components/data/types";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { NotificationList } from "@/components/profiles/notification-list";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Notifications" };

type NotificationsPayload = {
  notifications: UserNotificationDto[];
  unreadCount: number;
};

export default async function NotificationsPage() {
  const result = await serverApi<unknown>("/api/me/notifications?limit=100&offset=0");
  const payload = unwrapObject<NotificationsPayload>(result.data);
  const notifications = payload?.notifications ?? [];

  return (
    <div className="page-shell page-stack">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Espace personnel</p>
          <h1 className="page-title">Notifications</h1>
          <p>Retrouve ici les réponses de l’équipe concernant tes avis et tes contributions.</p>
        </div>
        <BellRing className="page-header__mark" size={58} aria-hidden="true" />
      </header>

      {result.error ? (
        <ErrorState message={result.error} retryHref="/profil/notifications" />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="Aucune notification"
          description="Les nouvelles réponses de l’équipe apparaîtront ici."
        />
      ) : (
        <NotificationList initialItems={notifications} />
      )}
    </div>
  );
}
