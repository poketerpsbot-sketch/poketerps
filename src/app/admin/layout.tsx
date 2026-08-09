import type { ReactNode } from "react";
import { getAdminDashboard } from "@/components/admin/admin-data";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErrorState } from "@/components/ui/states";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAdminDashboard();

  if (access.error) {
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
          message={access.error}
          retryHref="/admin"
        />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
