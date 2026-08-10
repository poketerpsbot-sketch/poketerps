import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: log }));

import { AppError, forbidden, unauthorized } from "@/lib/errors";
import { handleApi } from "@/lib/http";

function request(path: string): NextRequest {
  return new NextRequest(`https://pokedex.example.test${path}`, {
    method: "GET",
    headers: { "x-request-id": "request_123" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("API rejection logging", () => {
  it.each(["/api/me", "/api/auth/session"])(
    "logs a missing %s session as expected informational traffic",
    async (path) => {
      const response = await handleApi(request(path), async () => {
        throw unauthorized();
      });

      expect(response.status).toBe(401);
      expect(log.info).toHaveBeenCalledWith("api_session_missing", {
        requestId: "request_123",
        code: "UNAUTHORIZED",
        status: 401,
        path,
      });
      expect(log.warn).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a real 403", "/api/me", forbidden()],
    ["a 401 on another endpoint", "/api/admin/users", unauthorized()],
    ["another 4xx", "/api/me", new AppError("INVALID_REQUEST", "Invalide.", 400)],
  ])("keeps %s at warning level", async (_label, path, error) => {
    const response = await handleApi(request(path), async () => {
      throw error;
    });

    expect(response.status).toBe(error.status);
    expect(log.warn).toHaveBeenCalledWith("api_request_rejected", {
      requestId: "request_123",
      code: error.code,
      status: error.status,
    });
    expect(log.info).not.toHaveBeenCalled();
  });
});
