import "server-only";

import { forbidden } from "@/lib/errors";
import type { UserRole } from "@/lib/db/schema";

export type Permission =
  | "entry:create"
  | "entry:update:own"
  | "entry:update:any"
  | "entry:moderate"
  | "entry:delete:permanent"
  | "review:create"
  | "review:moderate"
  | "message:create"
  | "message:manage"
  | "partner:manage"
  | "category:manage"
  | "user:manage"
  | "settings:manage"
  | "badge:manage"
  | "publication:manage"
  | "contest:manage"
  | "contest:moderate"
  | "storage:upload:entry"
  | "storage:upload:partner"
  | "storage:upload:message"
  | "telegram:admin"
  | "bot:manage"
  | "audit:read"
  | "VIEW_ADMIN_ACTIVITY"
  | "VIEW_MODERATOR_ACTIVITY"
  | "VIEW_TEAM_AUDIT_LOG"
  | "MANAGE_CONTEST_WINNER";

const permissions: Record<UserRole, ReadonlySet<Permission | "*">> = {
  OWNER: new Set(["*"]),
  ADMIN: new Set([
    "entry:create",
    "entry:update:own",
    "entry:update:any",
    "entry:moderate",
    "review:create",
    "review:moderate",
    "message:create",
    "message:manage",
    "partner:manage",
    "category:manage",
    "user:manage",
    "settings:manage",
    "badge:manage",
    "publication:manage",
    "contest:manage",
    "contest:moderate",
    "storage:upload:entry",
    "storage:upload:partner",
    "storage:upload:message",
    "telegram:admin",
    "audit:read",
    "VIEW_MODERATOR_ACTIVITY",
    "MANAGE_CONTEST_WINNER",
  ]),
  MODERATOR: new Set([
    "entry:moderate",
    "entry:update:own",
    "review:create",
    "review:moderate",
    "message:create",
    "message:manage",
    "storage:upload:message",
    "telegram:admin",
    "contest:moderate",
  ]),
  EDITOR: new Set([
    "entry:create",
    "entry:update:own",
    "review:create",
    "message:create",
    "storage:upload:entry",
    "storage:upload:message",
  ]),
  MEMBER: new Set([
    "entry:create",
    "entry:update:own",
    "review:create",
    "message:create",
    "storage:upload:entry",
    "storage:upload:message",
  ]),
  BANNED: new Set(),
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = permissions[role];
  return rolePermissions.has("*") || rolePermissions.has(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) throw forbidden();
}

export function isAdminRole(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

/**
 * The full web console exposes cross-domain management data. Keep its entry
 * point limited to roles that own all of the core management permissions.
 * Individual API routes continue to enforce their own permission checks.
 */
export function canAccessWebAdmin(role: UserRole): boolean {
  return (
    (role === "OWNER" || role === "ADMIN") &&
    hasPermission(role, "user:manage") &&
    hasPermission(role, "settings:manage") &&
    hasPermission(role, "audit:read")
  );
}
