import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { lt } from "drizzle-orm";

import { verifyTelegramInitData } from "@/lib/auth/telegram";
import { getDb } from "@/lib/db";
import { getSqlClient } from "@/lib/db";
import { auditLogs, telegramAuthReplays, users, type UserRole } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { AppError, forbidden } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import { slugify } from "@/lib/validation/common";
import type { TelegramSender } from "@/lib/validation/telegram";
import type { CurrentUser } from "@/lib/auth/current-user";

export function roleForTelegramId(telegramId: number): UserRole {
  const env = getEnv();
  if (env.TELEGRAM_OWNER_IDS.includes(telegramId)) return "OWNER";
  if (env.TELEGRAM_ADMIN_IDS.includes(telegramId)) return "ADMIN";
  if (env.TELEGRAM_MODERATOR_IDS.includes(telegramId)) return "MODERATOR";
  return "MEMBER";
}

export async function authenticateTelegram(initData: string, requestId?: string) {
  const env = getEnv();
  const verified = verifyTelegramInitData(initData);
  const initDataHash = createHmac("sha256", env.RATE_LIMIT_SECRET).update(initData).digest("hex");
  const expiresAt = new Date(
    verified.authDate.getTime() + env.TELEGRAM_AUTH_MAX_AGE_SECONDS * 1_000,
  );
  const displayName = [verified.user.first_name, verified.user.last_name]
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);
  const role = roleForTelegramId(verified.user.id);

  const authenticatedUser = await getDb().transaction(async (tx) => {
    await tx.delete(telegramAuthReplays).where(lt(telegramAuthReplays.expiresAt, new Date()));
    const replayRows = await tx
      .insert(telegramAuthReplays)
      .values({
        initDataHash,
        telegramId: verified.user.id,
        authDate: verified.authDate,
        expiresAt,
      })
      .onConflictDoNothing({ target: telegramAuthReplays.initDataHash })
      .returning({ id: telegramAuthReplays.id });
    if (replayRows.length === 0) {
      throw new AppError(
        "TELEGRAM_INIT_DATA_REPLAY",
        "Ces données Telegram ont déjà été utilisées.",
        409,
      );
    }

    const updateValues: Partial<typeof users.$inferInsert> = {
      telegramUsername: verified.user.username ?? null,
      telegramUsernameSnapshot: verified.user.username ?? null,
      displayName,
      profilePhotoUrl: verified.user.photo_url ?? null,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };
    if (role === "OWNER" || role === "ADMIN" || role === "MODERATOR") {
      updateValues.role = role;
    }

    const [user] = await tx
      .insert(users)
      .values({
        telegramId: verified.user.id,
        telegramUsername: verified.user.username ?? null,
        telegramUsernameSnapshot: verified.user.username ?? null,
        displayName,
        profilePhotoUrl: verified.user.photo_url ?? null,
        // Public profile URLs must never expose the Telegram identifier.
        publicSlug: slugify(`${verified.user.username ?? displayName}-${randomUUID().slice(0, 8)}`),
        role,
      })
      .onConflictDoUpdate({ target: users.telegramId, set: updateValues })
      .returning({
        id: users.id,
        telegramId: users.telegramId,
        username: users.telegramUsername,
        displayName: users.displayName,
        publicSlug: users.publicSlug,
        profilePhotoUrl: users.profilePhotoUrl,
        role: users.role,
        isBanned: users.isBanned,
        suspendedAt: users.suspendedAt,
      });
    if (!user) throw new AppError("AUTHENTICATION_FAILED", "Authentification impossible.", 500);

    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: user.id,
        actorTelegramIdSnapshot: user.telegramId,
        action: "AUTH_TELEGRAM_LOGIN",
        entityType: "USER",
        entityId: user.id,
        requestId,
        metadata: { queryIdPresent: Boolean(verified.queryId) },
      }),
    );
    return user;
  });

  if (
    authenticatedUser.isBanned ||
    authenticatedUser.role === "BANNED" ||
    authenticatedUser.suspendedAt
  ) {
    throw forbidden("Compte suspendu.");
  }
  return authenticatedUser;
}

export async function upsertTrustedTelegramUser(sender: TelegramSender): Promise<CurrentUser> {
  if (sender.is_bot)
    throw new AppError("INVALID_TELEGRAM_USER", "Utilisateur Telegram invalide.", 401);
  const role = roleForTelegramId(sender.id);
  const displayName = [sender.first_name, sender.last_name].filter(Boolean).join(" ").slice(0, 120);
  const publicSlug = slugify(`${sender.username ?? displayName}-${randomUUID().slice(0, 8)}`);
  const [row] = await getSqlClient()<
    Array<{
      id: string;
      telegram_id: string | number;
      telegram_username: string | null;
      display_name: string;
      public_slug: string;
      profile_photo_url: string | null;
      role: UserRole;
      is_banned: boolean;
      suspended_at: Date | null;
    }>
  >`
    insert into users (
      account_kind, is_system, telegram_id, telegram_username,
      telegram_username_snapshot, display_name, public_slug, role, last_seen_at
    ) values (
      'TELEGRAM', false, ${sender.id}, ${sender.username ?? null},
      ${sender.username ?? null}, ${displayName}, ${publicSlug}, ${role}, now()
    )
    on conflict (telegram_id) do update set
      telegram_username = excluded.telegram_username,
      telegram_username_snapshot = excluded.telegram_username_snapshot,
      display_name = excluded.display_name,
      role = case
        when excluded.role in ('OWNER', 'ADMIN', 'MODERATOR') then excluded.role
        else users.role
      end,
      last_seen_at = now(),
      updated_at = now()
    returning id, telegram_id, telegram_username, display_name, public_slug,
      profile_photo_url, role, is_banned, suspended_at
  `;
  if (!row) throw new AppError("AUTHENTICATION_FAILED", "Authentification impossible.", 500);
  if (row.is_banned || row.role === "BANNED" || row.suspended_at)
    throw forbidden("Compte suspendu.");
  return {
    id: row.id,
    telegramId: Number(row.telegram_id),
    username: row.telegram_username,
    displayName: row.display_name,
    publicSlug: row.public_slug,
    profilePhotoUrl: row.profile_photo_url,
    role: row.role,
  };
}
