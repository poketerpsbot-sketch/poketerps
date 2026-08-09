import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__title">
          <strong>Console Pokédex</strong>
          <span>Actions administratives journalisées</span>
        </div>
        <AdminNav />
      </aside>
      <div className="admin-content page-stack">{children}</div>
    </div>
  );
}
