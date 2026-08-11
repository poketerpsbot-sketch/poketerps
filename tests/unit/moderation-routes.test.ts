import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  guardBrowserMutation: vi.fn(),
  moderateReview: vi.fn(),
  moderateEntry: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({ requireAdminUser: mocks.requireAdminUser }));
vi.mock("@/lib/security/request-guard", () => ({
  guardBrowserMutation: mocks.guardBrowserMutation,
  rateLimits: { admin: { namespace: "admin", limit: 60, windowSeconds: 600 } },
}));
vi.mock("@/lib/services/reviews", () => ({ moderateReview: mocks.moderateReview }));
vi.mock("@/lib/services/entries", () => ({
  moderateEntry: mocks.moderateEntry,
  permanentlyDeleteEntry: vi.fn(),
  softDeleteEntry: vi.fn(),
}));

import { PATCH as patchEntry } from "@/app/api/admin/entries/[id]/route";
import { PATCH as patchReview } from "@/app/api/admin/reviews/[id]/route";
import { forbidden } from "@/lib/errors";

const reviewId = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333";

function actor(role: "MODERATOR" | "ADMIN" | "OWNER") {
  return {
    id:
      `${role === "MODERATOR" ? "4" : role === "ADMIN" ? "5" : "6"}`.repeat(8) +
      "-4444-4444-8444-444444444444",
    telegramId: role === "OWNER" ? 6_675_436_692 : 100,
    username: role.toLowerCase(),
    displayName: role,
    publicSlug: role.toLowerCase(),
    profilePhotoUrl: null,
    role,
  };
}

function request(path: string, body: object) {
  return new NextRequest(`https://pokedex.example.test${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guardBrowserMutation.mockResolvedValue(undefined);
  mocks.moderateReview.mockResolvedValue({ id: reviewId, status: "PUBLISHED" });
  mocks.moderateEntry.mockResolvedValue({ id: entryId, status: "APPROVED" });
});

describe("moderation role/API matrix", () => {
  it("returns 403 to a MEMBER and never executes moderation", async () => {
    mocks.requireAdminUser.mockRejectedValue(forbidden());

    const response = await patchReview(
      request(`/api/admin/reviews/${reviewId}`, { status: "APPROVED" }),
      { params: Promise.resolve({ id: reviewId }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.moderateReview).not.toHaveBeenCalled();
  });

  it.each(["MODERATOR", "ADMIN", "OWNER"] as const)(
    "authorizes %s for review moderation with the internal user id",
    async (role) => {
      const current = actor(role);
      mocks.requireAdminUser.mockResolvedValue(current);

      const response = await patchReview(
        request(`/api/admin/reviews/${reviewId}`, {
          status: "REJECTED",
          reason: "Motif obligatoire",
        }),
        { params: Promise.resolve({ id: reviewId }) },
      );

      expect(response.status).toBe(200);
      expect(mocks.requireAdminUser).toHaveBeenCalledWith("review:moderate");
      expect(mocks.moderateReview).toHaveBeenCalledWith(
        reviewId,
        { status: "REJECTED", reason: "Motif obligatoire" },
        current,
        expect.any(String),
      );
    },
  );

  it.each(["MODERATOR", "ADMIN", "OWNER"] as const)(
    "authorizes %s for a pending entry action through entry:moderate",
    async (role) => {
      const current = actor(role);
      mocks.requireAdminUser.mockResolvedValue(current);

      const response = await patchEntry(
        request(`/api/admin/entries/${entryId}`, { status: "APPROVED" }),
        { params: Promise.resolve({ id: entryId }) },
      );

      expect(response.status).toBe(200);
      expect(mocks.requireAdminUser).toHaveBeenCalledWith("entry:moderate");
      expect(mocks.moderateEntry).toHaveBeenCalledWith(
        entryId,
        { status: "APPROVED" },
        current,
        expect.any(String),
      );
    },
  );
});
