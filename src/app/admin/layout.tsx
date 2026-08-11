import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErrorState } from "@/components/ui/states";
import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { isAdminRole } from "@/lib/auth/rbac";
import { resolvedTeamPermissions } from "@/lib/auth/team-permissions";
import { getAdminQueueCounts, type AdminQueueCounts } from "@/lib/services/admin-queues";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getOptionalCurrentUser();

  if (!user || !isAdminRole(user.role)) {
    return (
      <div className="page-shell page-stack">
        <header className="page-header">
          <div className="page-header__copy">
            <p className="eyebrow">Zone protégée</p>
            <h1 className="page-title">Administration</h1>
            <p>Cette console est réservée aux membres de l’équipe autorisés.</p>
          </div>
        </header>
        <ErrorState
          title="Accès administrateur impossible"
          message="Ouvre cette page depuis le bot Telegram pour établir ta session d’équipe."
          retryHref="/admin"
        />
      </div>
    );
  }

  let canViewTeamActivity = user.role === "OWNER" || user.role === "ADMIN";
  let queueCounts: AdminQueueCounts | undefined;
  try {
    const [permissions, counts] = await Promise.all([
      resolvedTeamPermissions(user),
      getAdminQueueCounts(user),
    ]);
    canViewTeamActivity = permissions.VIEW_ADMIN_ACTIVITY || permissions.VIEW_MODERATOR_ACTIVITY;
    queueCounts = counts;
  } catch {
    // Keep the role-safe fallback while a deployment and its migration overlap.
  }

  return (
    <AdminShell
      displayName={user.displayName}
      role={user.role}
      canViewTeamActivity={canViewTeamActivity}
      queueCounts={queueCounts}
    >
      {children}
    </AdminShell>
  );
}
