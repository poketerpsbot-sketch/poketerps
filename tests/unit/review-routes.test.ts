import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  guardBrowserMutation: vi.fn(),
  getEditableReview: vi.fn(),
  resubmitReview: vi.fn(),
  listUserNotifications: vi.fn(),
  markUserNotificationsRead: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({ requireCurrentUser: mocks.requireCurrentUser }));
vi.mock("@/lib/security/request-guard", () => ({
  guardBrowserMutation: mocks.guardBrowserMutation,
  rateLimits: {
    submission: { namespace: "submission", limit: 20, windowSeconds: 600 },
    mutation: { namespace: "mutation", limit: 60, windowSeconds: 600 },
  },
}));
vi.mock("@/lib/services/reviews", () => ({
  getEditableReview: mocks.getEditableReview,
  resubmitReview: mocks.resubmitReview,
}));
vi.mock("@/lib/services/notifications", () => ({
  listUserNotifications: mocks.listUserNotifications,
  markUserNotificationsRead: mocks.markUserNotificationsRead,
}));

import { GET as getReview, PATCH as patchReview } from "@/app/api/me/reviews/[id]/route";
import {
  GET as getNotifications,
  PATCH as patchNotifications,
} from "@/app/api/me/notifications/route";

const reviewId = "550e8400-e29b-41d4-a716-446655440000";
const actor = { id: "user-1", role: "MEMBER" };
const context = { params: Promise.resolve({ id: reviewId }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCurrentUser.mockResolvedValue(actor);
  mocks.guardBrowserMutation.mockResolvedValue(undefined);
});

describe("personal review routes", () => {
  it("always scopes editable review reads to the authenticated internal user", async () => {
    mocks.getEditableReview.mockResolvedValue({ id: reviewId, canEdit: true });
    const response = await getReview(
      new NextRequest(`https://pokedex.example.test/api/me/reviews/${reviewId}`),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.getEditableReview).toHaveBeenCalledWith(reviewId, actor);
  });

  it("guards and resubmits the corrected version for the authenticated owner", async () => {
    mocks.resubmitReview.mockResolvedValue({ id: reviewId, status: "PENDING_REVIEW" });
    const payload = {
      content: "Une nouvelle version suffisamment détaillée.",
      overallRating: 8,
      ratings: [],
    };
    const response = await patchReview(
      new NextRequest(`https://pokedex.example.test/api/me/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.guardBrowserMutation).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ namespace: "submission" }),
      "user-1",
    );
    expect(mocks.resubmitReview).toHaveBeenCalledWith(reviewId, payload, actor, expect.any(String));
  });
});

describe("personal notification routes", () => {
  it("lists notifications only for the authenticated internal user", async () => {
    mocks.listUserNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, total: 0 });
    const response = await getNotifications(
      new NextRequest("https://pokedex.example.test/api/me/notifications?limit=20&offset=0"),
    );
    expect(response.status).toBe(200);
    expect(mocks.listUserNotifications).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ limit: 20, offset: 0 }),
    );
  });

  it("never accepts a userId from the browser when marking a notification", async () => {
    mocks.markUserNotificationsRead.mockResolvedValue({ updated: 1 });
    const notificationId = "650e8400-e29b-41d4-a716-446655440000";
    const response = await patchNotifications(
      new NextRequest("https://pokedex.example.test/api/me/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notificationId }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.markUserNotificationsRead).toHaveBeenCalledWith("user-1", { notificationId });
  });
});
