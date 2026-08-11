import "server-only";

import type { CurrentUser } from "@/lib/auth/current-user";
import { hasPermission, type Permission } from "@/lib/auth/rbac";
import { getSqlClient } from "@/lib/db";
import { forbidden } from "@/lib/errors";

export type TeamActivityPermission =
  | "VIEW_ADMIN_ACTIVITY"
  | "VIEW_MODERATOR_ACTIVITY"
  | "VIEW_TEAM_AUDIT_LOG"
  | "MANAGE_CONTEST_WINNER";

export async function hasUserPermission(
  actor: Pick<CurrentUser, "id" | "role">,
  permission: TeamActivityPermission,
): Promise<boolean> {
  if (actor.role === "OWNER") return true;
  const [override] = await getSqlClient()<Array<{ is_granted: boolean }>>`
    select p.is_granted
    from user_permissions p
    where p.user_id=${actor.id}::uuid
      and p.permission_code=${permission}
      and (p.expires_at is null or p.expires_at > now())
    order by p.updated_at desc
    limit 1
  `;
  if (override) return override.is_granted;
  return hasPermission(actor.role, permission as Permission);
}

export async function requireUserPermission(
  actor: Pick<CurrentUser, "id" | "role">,
  permission: TeamActivityPermission,
): Promise<void> {
  if (!(await hasUserPermission(actor, permission))) {
    throw forbidden("Vous n’avez pas accès à cette activité d’équipe.");
  }
}

export async function resolvedTeamPermissions(actor: Pick<CurrentUser, "id" | "role">) {
  const [viewAdmins, viewModerators, viewAudit] = await Promise.all([
    hasUserPermission(actor, "VIEW_ADMIN_ACTIVITY"),
    hasUserPermission(actor, "VIEW_MODERATOR_ACTIVITY"),
    hasUserPermission(actor, "VIEW_TEAM_AUDIT_LOG"),
  ]);
  return {
    VIEW_ADMIN_ACTIVITY: viewAdmins,
    VIEW_MODERATOR_ACTIVITY: viewModerators,
    VIEW_TEAM_AUDIT_LOG: viewAudit,
  };
}
