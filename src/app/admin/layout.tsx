import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErrorState } from "@/components/ui/states";
import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { isAdminRole } from "@/lib/auth/rbac";

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

  return (
    <AdminShell displayName={user.displayName} role={user.role}>
      {children}
    </AdminShell>
  );
}
