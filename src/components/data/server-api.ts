import "server-only";

import { cookies, headers } from "next/headers";

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number;
};

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function originFromRequestHeaders(incoming: Headers) {
  const host = firstForwardedValue(incoming.get("x-forwarded-host") ?? incoming.get("host"));
  if (!host || /[\s/@\\?#]/.test(host)) return null;

  const forwardedProtocol = firstForwardedValue(incoming.get("x-forwarded-proto"));
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : "http";
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return null;
  }
}

function configuredOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

async function getRequestOrigin() {
  const configured = configuredOrigin();
  const incoming = await headers();
  const requestOrigin = originFromRequestHeaders(incoming);
  if (configured) {
    if (requestOrigin === configured) return configured;
    if (
      process.env.NODE_ENV === "development" &&
      requestOrigin &&
      isLoopbackOrigin(requestOrigin)
    ) {
      return requestOrigin;
    }
    return configured;
  }

  if (process.env.NODE_ENV === "development") {
    if (requestOrigin && isLoopbackOrigin(requestOrigin)) return requestOrigin;
    return "http://127.0.0.1:3000";
  }
  throw new Error("NEXT_PUBLIC_APP_URL must define the trusted server API origin.");
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object") {
    const message = (record.error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export async function serverApi<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const [origin, cookieStore] = await Promise.all([getRequestOrigin(), cookies()]);
    const url = new URL(path.startsWith("/") ? path : `/${path}`, origin);
    const response = await fetch(url, {
      ...init,
      cache: init.cache ?? "no-store",
      headers: {
        accept: "application/json",
        cookie: cookieStore.toString(),
        ...init.headers,
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload: unknown = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      return {
        data: null,
        error: getErrorMessage(
          payload,
          response.status === 401
            ? "Connecte-toi avec Telegram pour accéder à cet espace."
            : response.status === 403
              ? "Tu n’as pas l’autorisation d’accéder à cet espace."
              : response.status === 404
                ? "Cette ressource est introuvable."
                : "Le Pokédex n’a pas pu joindre le service de données.",
        ),
        status: response.status,
      };
    }

    return { data: payload as T, error: null, status: response.status };
  } catch {
    return {
      data: null,
      error:
        "Le service de données est momentanément indisponible. Réessaie dans quelques instants.",
      status: 503,
    };
  }
}

export function unwrapData<T>(payload: unknown): T | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if ("data" in record) return record.data as T;
  }
  return payload as T;
}

export function unwrapList<T>(payload: unknown, candidateKeys: string[] = []): T[] {
  const value = unwrapData<unknown>(payload);
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  for (const key of ["items", "results", ...candidateKeys]) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

export function unwrapObject<T>(payload: unknown, candidateKeys: string[] = []) {
  const value = unwrapData<unknown>(payload);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of candidateKeys) {
    const candidate = record[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as T;
    }
  }
  return value as T;
}
