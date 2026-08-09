import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

import { AppError, validationError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type ApiContext = { requestId: string };

export function apiJson<T>(data: T, init?: ResponseInit): NextResponse<{ data: T }> {
  const response = NextResponse.json({ data }, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export function apiList<T>(
  data: T[],
  pagination: { limit: number; offset: number; total?: number },
  init?: ResponseInit,
) {
  const response = NextResponse.json({ data, pagination }, init);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = 64_000,
): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Le corps doit être au format JSON.", 415);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Requête trop volumineuse.", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Requête trop volumineuse.", 413);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON", "JSON invalide.", 400);
  }
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function parseSearchParams<T>(request: NextRequest, schema: ZodType<T>): T {
  const object = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = schema.safeParse(object);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function assertSameOrigin(request: Request): void {
  const expectedOrigin = new URL(getEnv().NEXT_PUBLIC_APP_URL).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin) {
    throw new AppError("INVALID_ORIGIN", "Origine de requête refusée.", 403);
  }
  if (!origin && request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError("INVALID_ORIGIN", "Origine de requête refusée.", 403);
  }
}

function requestIdFrom(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{8,80}$/.test(supplied) ? supplied : randomUUID();
}

function errorResponse(error: unknown, requestId: string): NextResponse {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? validationError(error)
        : new AppError("INTERNAL_ERROR", "Une erreur interne est survenue.", 500, {
            cause: error,
            expose: false,
          });
  if (appError.status >= 500) {
    logger.error("api_request_failed", { requestId, error });
  } else {
    logger.warn("api_request_rejected", {
      requestId,
      code: appError.code,
      status: appError.status,
    });
  }

  const response = NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.expose ? appError.message : "Une erreur interne est survenue.",
        ...(appError.expose && appError.details !== undefined ? { details: appError.details } : {}),
      },
    },
    { status: appError.status },
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  const retryAfter =
    appError.details && typeof appError.details === "object" && "retryAfter" in appError.details
      ? Number((appError.details as { retryAfter: unknown }).retryAfter)
      : 0;
  if (retryAfter > 0) response.headers.set("Retry-After", String(Math.ceil(retryAfter)));
  return response;
}

export async function handleApi(
  request: NextRequest,
  operation: (context: ApiContext) => Promise<Response>,
): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    const response = await operation({ requestId });
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
