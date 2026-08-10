import type { ReactNode } from "react";
import { getAdminDashboard } from "@/components/admin/admin-data";
import { AdminShell } from "@/components/admin/admin-shell";
import { serverApi, unwrapObject } from "@/components/data/server-api";
import { ErrorState } from "@/components/ui/states";
import { canAccessWebAdmin } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/db/schema";

const roles: UserRole[] = ["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [access, session] = await Promise.all([
    getAdminDashboard(),
    serverApi<unknown>("/api/auth/session"),
  ]);
  const user = unwrapObject<Record<string, unknown>>(session.data, ["user"]);
  const role =
    typeof user?.role === "string" && roles.includes(user.role as UserRole)
      ? (user.role as UserRole)
      : null;
  const canOpenConsole = role ? canAccessWebAdmin(role) : false;

  if (access.error || session.error || !canOpenConsole) {
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
          message={
            access.error ??
            session.error ??
            "Le panneau complet est réservé aux propriétaires et administrateurs autorisés."
          }
          retryHref="/admin"
        />
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
