import "server-only";

import { createHmac } from "node:crypto";

import { getSqlClient } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export type RateLimitPolicy = {
  namespace: string;
  limit: number;
  windowSeconds: number;
};

function hashKey(namespace: string, identifier: string): string {
  return createHmac("sha256", getEnv().RATE_LIMIT_SECRET)
    .update(`${namespace}:${identifier}`)
    .digest("hex");
}

export function requestFingerprint(request: Request): string {
  const forwardedChain = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const forwarded = forwardedChain?.at(-1);
  const address = request.headers.get("cf-connecting-ip") || forwarded || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? "unknown";
  return `${address}|${userAgent}`;
}

export async function enforceRateLimit(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<{ remaining: number; resetAt: Date }> {
  const now = Date.now();
  const windowMilliseconds = policy.windowSeconds * 1_000;
  const windowStartedAt = new Date(Math.floor(now / windowMilliseconds) * windowMilliseconds);
  const resetAt = new Date(windowStartedAt.getTime() + windowMilliseconds);
  const expiresAt = new Date(resetAt.getTime() + windowMilliseconds);
  const keyHash = hashKey(policy.namespace, identifier);
  const sql = getSqlClient();

  // postgres.js raw tagged queries do not reliably serialize Date instances in every runtime.
  // Keep Dates for the public result, but normalize raw SQL parameters at this boundary.
  const windowStartedAtSql = windowStartedAt.toISOString();
  const expiresAtSql = expiresAt.toISOString();

  const [bucket] = await sql<{ request_count: number }[]>`
    insert into rate_limit_buckets (key_hash, window_started_at, request_count, expires_at)
    values (${keyHash}, ${windowStartedAtSql}::timestamptz, 1, ${expiresAtSql}::timestamptz)
    on conflict (key_hash) do update set
      request_count = case
        when rate_limit_buckets.window_started_at < excluded.window_started_at then 1
        else rate_limit_buckets.request_count + 1
      end,
      window_started_at = greatest(rate_limit_buckets.window_started_at, excluded.window_started_at),
      expires_at = excluded.expires_at
    returning request_count
  `;
  const count = Number(bucket?.request_count ?? policy.limit + 1);
  if (count > policy.limit) {
    throw new AppError("RATE_LIMITED", "Trop de requêtes. Réessaie plus tard.", 429, {
      details: { retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1_000)) },
    });
  }
  return { remaining: Math.max(0, policy.limit - count), resetAt };
}
