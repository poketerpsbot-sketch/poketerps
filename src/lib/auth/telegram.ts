import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";

const telegramUserSchema = z.object({
  id: z.number().int().positive().safe(),
  is_bot: z.boolean().optional(),
  first_name: z.string().trim().min(1).max(128),
  last_name: z.string().trim().max(128).optional(),
  username: z.string().trim().max(64).optional(),
  language_code: z.string().trim().max(16).optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.url().max(2_000).optional(),
  allows_write_to_pm: z.boolean().optional(),
});

export type VerifiedTelegramUser = z.infer<typeof telegramUserSchema>;

export type VerifiedInitData = {
  user: VerifiedTelegramUser;
  authDate: Date;
  queryId?: string;
  rawHash: string;
};

export function verifyTelegramInitData(rawInitData: string, now = new Date()): VerifiedInitData {
  const env = getEnv();
  if (!rawInitData || rawInitData.length > 10_000) {
    throw new AppError("INVALID_TELEGRAM_INIT_DATA", "Données Telegram invalides.", 401);
  }

  const params = new URLSearchParams(rawInitData);
  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key))
      throw new AppError("INVALID_TELEGRAM_INIT_DATA", "Données Telegram ambiguës.", 401);
    seen.add(key);
  }

  const receivedHash = params.get("hash")?.toLowerCase();
  if (!receivedHash || !/^[a-f0-9]{64}$/.test(receivedHash)) {
    throw new AppError("INVALID_TELEGRAM_SIGNATURE", "Signature Telegram invalide.", 401);
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const suppliedHash = Buffer.from(receivedHash, "hex");
  if (suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
    throw new AppError("INVALID_TELEGRAM_SIGNATURE", "Signature Telegram invalide.", 401);
  }

  const authDateSeconds = Number(params.get("auth_date"));
  if (!Number.isSafeInteger(authDateSeconds) || authDateSeconds <= 0) {
    throw new AppError("INVALID_TELEGRAM_AUTH_DATE", "Date Telegram invalide.", 401);
  }
  const ageSeconds = Math.floor(now.getTime() / 1_000) - authDateSeconds;
  if (ageSeconds < -30 || ageSeconds > env.TELEGRAM_AUTH_MAX_AGE_SECONDS) {
    throw new AppError("EXPIRED_TELEGRAM_INIT_DATA", "Authentification Telegram expirée.", 401);
  }

  const userJson = params.get("user");
  if (!userJson) throw new AppError("TELEGRAM_USER_MISSING", "Utilisateur Telegram absent.", 401);

  let decodedUser: unknown;
  try {
    decodedUser = JSON.parse(userJson);
  } catch {
    throw new AppError("INVALID_TELEGRAM_USER", "Utilisateur Telegram invalide.", 401);
  }
  const userResult = telegramUserSchema.safeParse(decodedUser);
  if (!userResult.success || userResult.data.is_bot) {
    throw new AppError("INVALID_TELEGRAM_USER", "Utilisateur Telegram invalide.", 401);
  }

  return {
    user: userResult.data,
    authDate: new Date(authDateSeconds * 1_000),
    queryId: params.get("query_id") ?? undefined,
    rawHash: receivedHash,
  };
}
