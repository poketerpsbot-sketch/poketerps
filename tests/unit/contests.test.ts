import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  contestParticipationInputSchema,
  createContestSchema,
  moderateContestParticipationSchema,
} from "@/lib/validation/contests";

const mocks = vi.hoisted(() => ({
  createContest: vi.fn(),
  getOptionalCurrentUser: vi.fn(),
  getPublicContest: vi.fn(),
  listAdminContests: vi.fn(),
  listPublicContests: vi.fn(),
  requireAdminUser: vi.fn(),
  enforceRateLimit: vi.fn(),
  guardBrowserMutation: vi.fn(),
}));

vi.mock("@/lib/services/contests", () => ({
  getPublicContest: mocks.getPublicContest,
  listPublicContests: mocks.listPublicContests,
}));
vi.mock("@/lib/services/admin-contests", () => ({
  createContest: mocks.createContest,
  listAdminContests: mocks.listAdminContests,
}));
vi.mock("@/lib/auth/current-user", () => ({
  getOptionalCurrentUser: mocks.getOptionalCurrentUser,
}));
vi.mock("@/lib/auth/admin", () => ({ requireAdminUser: mocks.requireAdminUser }));
vi.mock("@/lib/security/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/security/request-guard", () => ({
  guardBrowserMutation: mocks.guardBrowserMutation,
  rateLimits: { admin: { namespace: "admin", limit: 1, windowSeconds: 60 } },
}));

import { GET as getAdminContests, POST as postAdminContest } from "@/app/api/admin/contests/route";
import { GET as getContest } from "@/app/api/contests/[slug]/route";
import { GET as getContests } from "@/app/api/contests/route";

const validContest = {
  slug: "coupe-aout",
  title: "Coupe d'août",
  summary: "Le rendez-vous communautaire du mois.",
  description: "Présentez votre meilleure capture à la communauté.",
  rules: "Une fiche publiée par participant.",
  status: "SCHEDULED" as const,
  isFeatured: true,
  startsAt: "2026-08-12T12:00:00.000Z",
  endsAt: "2026-08-20T12:00:00.000Z",
  scoringMode: "ENTRY_LIKES" as const,
  criteria: {},
  reward: { title: "Coupe d'or" },
  requireEntry: true,
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getOptionalCurrentUser.mockResolvedValue(null);
  mocks.requireAdminUser.mockResolvedValue({ id: "admin", role: "ADMIN" });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.guardBrowserMutation.mockResolvedValue(undefined);
});

describe("contest validation", () => {
  it("accepts a complete contest and rejects inverted dates", () => {
    expect(createContestSchema.safeParse(validContest).success).toBe(true);
    expect(
      createContestSchema.safeParse({
        ...validContest,
        endsAt: "2026-08-10T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("keeps participation and moderation payloads narrow", () => {
    expect(contestParticipationInputSchema.safeParse({ statement: "Je participe" }).success).toBe(
      true,
    );
    expect(contestParticipationInputSchema.safeParse({ entryId: "not-an-id" }).success).toBe(false);
    expect(moderateContestParticipationSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
    expect(moderateContestParticipationSchema.safeParse({ status: "WITHDRAWN" }).success).toBe(
      false,
    );
  });
});

describe("contest route contracts", () => {
  it("serves paginated public contests", async () => {
    mocks.listPublicContests.mockResolvedValue({
      contests: [{ id: "contest-1", slug: "coupe-aout", phase: "UPCOMING" }],
      total: 1,
    });
    const response = await getContests(
      new NextRequest("https://pokedex.example.test/api/contests?phase=upcoming&limit=12&offset=0"),
    );
    expect(response.status).toBe(200);
    expect(mocks.listPublicContests).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "upcoming", limit: 12, offset: 0 }),
    );
    expect(await response.json()).toMatchObject({ pagination: { total: 1 } });
  });

  it("adds the viewer participation to contest detail without requiring a session", async () => {
    mocks.getOptionalCurrentUser.mockResolvedValue({ id: "viewer" });
    mocks.getPublicContest.mockResolvedValue({ slug: "coupe-aout", viewerParticipation: null });
    const response = await getContest(
      new NextRequest("https://pokedex.example.test/api/contests/coupe-aout"),
      { params: Promise.resolve({ slug: "coupe-aout" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.getPublicContest).toHaveBeenCalledWith("coupe-aout", "viewer");
  });

  it("separates contest moderation from contest configuration", async () => {
    mocks.listAdminContests.mockResolvedValue({ contests: [], total: 0 });
    await getAdminContests(
      new NextRequest("https://pokedex.example.test/api/admin/contests?limit=20&offset=0"),
    );
    expect(mocks.requireAdminUser).toHaveBeenCalledWith("contest:moderate");

    mocks.createContest.mockResolvedValue({ id: "contest-1", ...validContest });
    const response = await postAdminContest(
      new NextRequest("https://pokedex.example.test/api/admin/contests", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://pokedex.example.test" },
        body: JSON.stringify(validContest),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.requireAdminUser).toHaveBeenLastCalledWith("contest:manage");
  });
});
