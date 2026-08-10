import type { UserRole } from "@/lib/db/schema";

export const userRoles = ["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"] as const;

export type SessionIdentity = {
  displayName: string;
  username: string | null;
  profilePhotoUrl: string | null;
  publicSlug: string | null;
  role: UserRole;
};

export const roleLabels: Record<UserRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MODERATOR: "Modérateur",
  EDITOR: "Éditeur",
  MEMBER: "Membre",
  BANNED: "Compte suspendu",
};

export function normalizeUserRole(value: unknown): UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole)
    ? (value as UserRole)
    : "MEMBER";
}

export function canAccessFullAdminConsole(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canAccessModerationConsole(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MODERATOR";
}

export function sessionIdentity(payload: unknown): SessionIdentity | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const envelope =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const candidate =
    envelope.user && typeof envelope.user === "object" && !Array.isArray(envelope.user)
      ? (envelope.user as Record<string, unknown>)
      : envelope;
  if (typeof candidate.displayName !== "string") return null;

  return {
    displayName: candidate.displayName,
    username: typeof candidate.username === "string" ? candidate.username : null,
    profilePhotoUrl:
      typeof candidate.profilePhotoUrl === "string" ? candidate.profilePhotoUrl : null,
    publicSlug: typeof candidate.publicSlug === "string" ? candidate.publicSlug : null,
    role: normalizeUserRole(candidate.role),
  };
}
