import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { RoleBadge } from "@/components/ui/role-badge";
import type { UserRole } from "@/lib/db/schema";

export function AdminShell({
  children,
  displayName,
  role,
}: {
  children: ReactNode;
  displayName: string;
  role: UserRole;
}) {
  return (
    <div className="page-shell admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__title">
          <strong>Console Pokédex</strong>
          <span>Actions administratives journalisées</span>
        </div>
        <div className="admin-sidebar__identity">
          <strong>{displayName}</strong>
          <RoleBadge role={role} compact />
        </div>
        <AdminNav role={role} />
      </aside>
      <div className="admin-content page-stack">{children}</div>
    </div>
  );
}
