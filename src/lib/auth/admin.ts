import "server-only";

import { requireCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { assertPermission, isAdminRole, type Permission } from "@/lib/auth/rbac";
import { requireUserPermission } from "@/lib/auth/team-permissions";
import { forbidden } from "@/lib/errors";

export async function requireAdminUser(permission?: Permission): Promise<CurrentUser> {
  const actor = await requireCurrentUser();
  if (!isAdminRole(actor.role)) throw forbidden();
  if (permission) assertPermission(actor.role, permission);
  return actor;
}

export async function requireContestWinnerManager(): Promise<CurrentUser> {
  const actor = await requireCurrentUser();
  if (!isAdminRole(actor.role)) throw forbidden();
  await requireUserPermission(actor, "MANAGE_CONTEST_WINNER");
  return actor;
}
