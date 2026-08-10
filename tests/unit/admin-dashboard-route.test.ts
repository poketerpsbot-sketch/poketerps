import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  enforceRateLimit: vi.fn(),
  getAdminDashboard: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({ requireAdminUser: mocks.requireAdminUser }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/services/admin", () => ({ getAdminDashboard: mocks.getAdminDashboard }));

import { GET } from "@/app/api/admin/dashboard/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  mocks.enforceRateLimit.mockResolvedValue({
    remaining: 29,
    resetAt: new Date("2026-08-10T00:01:00.000Z"),
  });
  mocks.getAdminDashboard.mockResolvedValue({ totalUsers: 4 });
});

describe("GET /api/admin/dashboard", () => {
  it("requires the full-console audit permission before returning statistics", async () => {
    const response = await GET(new NextRequest("https://pokedex.example.test/api/admin/dashboard"));

    expect(response.status).toBe(200);
    expect(mocks.requireAdminUser).toHaveBeenCalledWith("audit:read");
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "admin" }),
      "admin-1",
    );
    expect(mocks.getAdminDashboard).toHaveBeenCalledTimes(1);
  });
});
