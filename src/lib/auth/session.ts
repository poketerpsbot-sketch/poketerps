import "server-only";

import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  endUserSession,
  recordUserSession,
  type SessionPlatform,
} from "@/lib/services/user-activity";

export const PRODUCTION_SESSION_COOKIE_NAME = "__Host-pokedex_session";
export const DEVELOPMENT_SESSION_COOKIE_NAME = "pokedex_session";

export function sessionCookieName(environment = getEnv().NODE_ENV): string {
  return environment === "production"
    ? PRODUCTION_SESSION_COOKIE_NAME
    : DEVELOPMENT_SESSION_COOKIE_NAME;
}

export type SessionPayload = {
  userId: string;
  sessionId: string;
  expiresAt: Date;
};

function signingKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function signSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const env = getEnv();
  const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE_SECONDS * 1_000);
  const sessionId = randomUUID();
  const token = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer("pokedex")
    .setAudience("pokedex-web")
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
    .setJti(randomUUID())
    .sign(signingKey());
  return { token, expiresAt, sessionId };
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer: "pokedex",
      audience: "pokedex-web",
    });
    if (!payload.sub || typeof payload.sid !== "string" || typeof payload.exp !== "number")
      return null;
    return {
      userId: payload.sub,
      sessionId: payload.sid,
      expiresAt: new Date(payload.exp * 1_000),
    };
  } catch {
    return null;
  }
}

export async function createSession(
  userId: string,
  context: { platform?: SessionPlatform; appVersion?: string | null } = {},
): Promise<void> {
  const env = getEnv();
  const { token, expiresAt, sessionId } = await signSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(env.NODE_ENV), token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
  try {
    await recordUserSession({
      userId,
      clientSessionId: sessionId,
      platform: context.platform ?? "UNKNOWN",
      appVersion: context.appVersion,
    });
  } catch (error) {
    logger.warn("user_session_analytics_failed", { userId, error });
  }
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  return token ? verifySessionToken(token) : null;
}

export async function deleteSession(): Promise<void> {
  const session = await readSession();
  if (session) {
    try {
      await endUserSession(session.sessionId);
    } catch (error) {
      logger.warn("user_session_end_failed", { userId: session.userId, error });
    }
  }
  (await cookies()).delete(sessionCookieName());
}
