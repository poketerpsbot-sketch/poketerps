import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOptionalCurrentUser: vi.fn(),
  guardBrowserMutation: vi.fn(),
  requireCurrentUser: vi.fn(),
  searchCatalogue: vi.fn(),
  setEntryLike: vi.fn(),
  tryRecordUserActivityEvent: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({
  getOptionalCurrentUser: mocks.getOptionalCurrentUser,
  requireCurrentUser: mocks.requireCurrentUser,
}));
vi.mock("@/lib/security/request-guard", () => ({
  guardBrowserMutation: mocks.guardBrowserMutation,
  rateLimits: { mutation: { namespace: "mutation", limit: 1, windowSeconds: 60 } },
}));
vi.mock("@/lib/services/catalogue", () => ({ searchCatalogue: mocks.searchCatalogue }));
vi.mock("@/lib/services/engagement", () => ({ setEntryLike: mocks.setEntryLike }));
vi.mock("@/lib/services/user-activity", () => ({
  tryRecordUserActivityEvent: mocks.tryRecordUserActivityEvent,
}));

import { GET as getCatalogue } from "@/app/api/catalogue/route";
import { PUT as putLike } from "@/app/api/entries/[id]/likes/route";

const actor = { id: "11111111-1111-4111-8111-111111111111", role: "MEMBER" };
const entryId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getOptionalCurrentUser.mockResolvedValue(actor);
  mocks.requireCurrentUser.mockResolvedValue(actor);
  mocks.guardBrowserMutation.mockResolvedValue(undefined);
  mocks.tryRecordUserActivityEvent.mockResolvedValue(undefined);
});

describe("user activity route wiring", () => {
  it("records a successful like after the interaction", async () => {
    mocks.setEntryLike.mockResolvedValue({ liked: true, likeCount: 4 });
    const response = await putLike(
      new NextRequest(`https://pokedex.example.test/api/entries/${entryId}/likes`, {
        method: "PUT",
      }),
      { params: Promise.resolve({ id: entryId }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.tryRecordUserActivityEvent).toHaveBeenCalledWith({
      userId: actor.id,
      eventType: "LIKE",
      entityType: "ENTRY",
      entityId: entryId,
    });
  });

  it("records an authenticated PokéTerps search without storing the search text", async () => {
    mocks.searchCatalogue.mockResolvedValue({ entries: [], total: 0 });
    const response = await getCatalogue(
      new NextRequest("https://pokedex.example.test/api/catalogue?query=secret&limit=20&offset=0"),
    );
    expect(response.status).toBe(200);
    expect(mocks.tryRecordUserActivityEvent).toHaveBeenCalledWith({
      userId: actor.id,
      eventType: "SEARCH",
      metadata: { hasText: true, categoryFiltered: false, results: 0 },
    });
    expect(JSON.stringify(mocks.tryRecordUserActivityEvent.mock.calls)).not.toContain("secret");
  });
});
