import "server-only";

import { getSqlClient } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";
import { forbidden } from "@/lib/errors";

export type UserAccessState = {
  id: string;
  role: UserRole;
  isBanned: boolean;
  suspendedAt: Date | string | null;
  bannedUntil: Date | string | null;
};

export type BanAccessDecision = "ALLOW" | "BLOCK" | "EXPIRE";

export function banAccessDecision(
  state: Omit<UserAccessState, "id">,
  now = new Date(),
): BanAccessDecision {
  const activeMarker = state.isBanned || state.role === "BANNED" || state.suspendedAt !== null;
  const expiry = state.bannedUntil ? new Date(state.bannedUntil) : null;
  if (expiry && Number.isFinite(expiry.valueOf())) {
    if (expiry > now) return "BLOCK";
    if (state.isBanned) return "EXPIRE";
  }
  return activeMarker ? "BLOCK" : "ALLOW";
}

export async function resolveUserAccess(state: UserAccessState): Promise<UserRole> {
  const decision = banAccessDecision(state);
  if (decision === "ALLOW") return state.role;
  if (decision === "BLOCK") throw forbidden("Compte suspendu.");

  await getSqlClient()`select public.expire_user_ban(${state.id}::uuid)`;
  const [fresh] = await getSqlClient()<
    Array<{
      role: UserRole;
      is_banned: boolean;
      suspended_at: Date | null;
      banned_until: Date | null;
    }>
  >`
    select role::text,is_banned,suspended_at,banned_until
    from users where id=${state.id}::uuid limit 1
  `;
  if (!fresh) throw forbidden("Compte suspendu.");
  if (
    banAccessDecision({
      role: fresh.role,
      isBanned: fresh.is_banned,
      suspendedAt: fresh.suspended_at,
      bannedUntil: fresh.banned_until,
    }) !== "ALLOW"
  ) {
    throw forbidden("Compte suspendu.");
  }
  return fresh.role;
}
