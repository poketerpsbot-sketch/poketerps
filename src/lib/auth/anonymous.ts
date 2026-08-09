import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";

export const PRODUCTION_ANONYMOUS_COOKIE_NAME = "__Host-pokedex_anon";
export const DEVELOPMENT_ANONYMOUS_COOKIE_NAME = "pokedex_anon";

export function anonymousCookieName(environment = getEnv().NODE_ENV): string {
  return environment === "production"
    ? PRODUCTION_ANONYMOUS_COOKIE_NAME
    : DEVELOPMENT_ANONYMOUS_COOKIE_NAME;
}

export async function getAnonymousSessionHash(): Promise<string> {
  const env = getEnv();
  const cookieStore = await cookies();
  const cookieName = anonymousCookieName(env.NODE_ENV);
  let identifier = cookieStore.get(cookieName)?.value;
  if (!identifier || !/^[a-f0-9-]{36}$/.test(identifier)) {
    identifier = randomUUID();
    cookieStore.set(cookieName, identifier, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 31_536_000,
      priority: "low",
    });
  }
  return createHmac("sha256", env.RATE_LIMIT_SECRET).update(identifier).digest("hex");
}
