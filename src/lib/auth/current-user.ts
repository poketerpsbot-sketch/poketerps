import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import { forbidden, unauthorized } from "@/lib/errors";
import { readSession } from "@/lib/auth/session";

export type CurrentUser = {
  id: string;
  telegramId: number | null;
  username: string | null;
  displayName: string;
  publicSlug: string;
  profilePhotoUrl: string | null;
  role: UserRole;
};

export async function getOptionalCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const [user] = await getDb()
    .select({
      id: users.id,
      telegramId: users.telegramId,
      username: users.telegramUsername,
      displayName: users.displayName,
      publicSlug: users.publicSlug,
      profilePhotoUrl: users.profilePhotoUrl,
      role: users.role,
      isBanned: users.isBanned,
      suspendedAt: users.suspendedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return null;
  if (user.isBanned || user.role === "BANNED" || user.suspendedAt)
    throw forbidden("Compte suspendu.");
  return user;
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getOptionalCurrentUser();
  if (!user) throw unauthorized();
  return user;
}
