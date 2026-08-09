import "server-only";

import { requireCurrentUser, type CurrentUser } from "@/lib/auth/current-user";
import { assertPermission, isAdminRole, type Permission } from "@/lib/auth/rbac";
import { forbidden } from "@/lib/errors";

export async function requireAdminUser(permission?: Permission): Promise<CurrentUser> {
  const actor = await requireCurrentUser();
  if (!isAdminRole(actor.role)) throw forbidden();
  if (permission) assertPermission(actor.role, permission);
  return actor;
}
