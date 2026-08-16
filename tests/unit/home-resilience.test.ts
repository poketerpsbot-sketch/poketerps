import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOptionalCurrentUser: vi.fn(),
  searchCatalogue: vi.fn(),
  getTrainerRankings: vi.fn(),
  listPartners: vi.fn(),
  listPublicContests: vi.fn(),
  getDb: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({
  getOptionalCurrentUser: mocks.getOptionalCurrentUser,
}));
vi.mock("@/lib/db", () => ({
  getDb: mocks.getDb,
  getSqlClient: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.warn, info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/services/catalogue", () => ({ searchCatalogue: mocks.searchCatalogue }));
vi.mock("@/lib/services/contests", () => ({ listPublicContests: mocks.listPublicContests }));
vi.mock("@/lib/services/partners", () => ({ listPartners: mocks.listPartners }));
vi.mock("@/lib/services/rankings", () => ({ getTrainerRankings: mocks.getTrainerRankings }));

import { getHomeData } from "@/lib/services/home";

function homeSectionsQuery(rows: unknown[]) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.from = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => Promise.resolve(rows));
  return query;
}

describe("home data resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOptionalCurrentUser.mockResolvedValue(null);
    mocks.getDb.mockReturnValue({ select: vi.fn(() => homeSectionsQuery([])) });
    mocks.searchCatalogue.mockImplementation(({ sort }: { sort: string }) => {
      if (sort === "views") return Promise.reject(new Error("column b.image_url does not exist"));
      return Promise.resolve({
        entries: [{ id: "entry-1", slug: "blue-zushi", name: "Blue Zushi" }],
        total: 1,
      });
    });
    mocks.getTrainerRankings.mockRejectedValue(new Error("secondary ranking unavailable"));
    mocks.listPartners.mockResolvedValue({ partners: [], total: 0 });
    mocks.listPublicContests.mockResolvedValue({ contests: [], total: 0 });
  });

  it("keeps the homepage usable when rankings or trending fail", async () => {
    const home = await getHomeData();

    expect(home.latest).toHaveLength(1);
    expect(home.dailyDiscovery).toMatchObject({ slug: "blue-zushi" });
    expect(home.trendingEntries).toEqual([]);
    expect(home.topTrainers).toEqual([]);
    expect(home.availability).toMatchObject({ latest: true, trending: false, trainers: false });
    expect(mocks.warn).toHaveBeenCalledWith(
      "home_section_unavailable",
      expect.objectContaining({ area: "home", section: "trending" }),
    );
  });
});
