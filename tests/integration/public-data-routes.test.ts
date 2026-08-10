import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  getEntryRankingPage: vi.fn(),
  getHomeData: vi.fn(),
  getOptionalCurrentUser: vi.fn(),
  getTrainerRankingPage: vi.fn(),
  listCategories: vi.fn(),
  searchCatalogue: vi.fn(),
}));

vi.mock("@/lib/services/home", () => ({ getHomeData: services.getHomeData }));
vi.mock("@/lib/services/catalogue", () => ({ searchCatalogue: services.searchCatalogue }));
vi.mock("@/lib/services/categories", () => ({ listCategories: services.listCategories }));
vi.mock("@/lib/auth/current-user", () => ({
  getOptionalCurrentUser: services.getOptionalCurrentUser,
}));
vi.mock("@/lib/services/rankings", () => ({
  getEntryRankingPage: services.getEntryRankingPage,
  getTrainerRankingPage: services.getTrainerRankingPage,
}));

import { GET as getCatalogue } from "@/app/api/catalogue/route";
import { GET as getCategories } from "@/app/api/categories/route";
import { GET as getHome } from "@/app/api/home/route";
import { GET as getEntryRankings } from "@/app/api/rankings/entries/route";
import { GET as getTrainerRankings } from "@/app/api/rankings/trainers/route";

const category = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "fleurs",
  name: "Fleurs",
  subcategories: [],
  fields: [],
};
const entry = {
  id: "00000000-0000-4000-8000-000000000002",
  slug: "capture-test",
  name: "Capture test",
  category: { slug: "fleurs", name: "Fleurs" },
};

beforeEach(() => {
  for (const mock of Object.values(services)) mock.mockReset();
  services.getOptionalCurrentUser.mockResolvedValue(null);
});

describe("public data route contracts", () => {
  it("serves the home DTO from /api/home", async () => {
    services.getHomeData.mockResolvedValue({
      latest: [entry],
      mostViewed: [],
      mostLiked: [],
      bestRated: [],
      categories: [category],
      topTrainers: [],
      featuredPartners: [],
      sections: [],
    });

    const response = await getHome(new NextRequest("https://poketerps.test/api/home"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { latest: [entry], categories: [category] },
    });
  });

  it("serves catalogue entries and pagination from /api/catalogue", async () => {
    services.searchCatalogue.mockResolvedValue({ entries: [entry], total: 1 });

    const response = await getCatalogue(
      new NextRequest(
        "https://poketerps.test/api/catalogue?limit=24&offset=0&sort=recent&category=fleurs",
      ),
    );

    expect(response.status).toBe(200);
    expect(services.searchCatalogue).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 24, offset: 0, sort: "recent", category: "fleurs" }),
    );
    expect(await response.json()).toEqual({
      data: [entry],
      pagination: { limit: 24, offset: 0, total: 1 },
    });
  });

  it("serves capture taxonomy from /api/categories", async () => {
    services.listCategories.mockResolvedValue([category]);

    const response = await getCategories(new NextRequest("https://poketerps.test/api/categories"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [category] });
  });

  it("serves both ranking list DTOs with validated query values", async () => {
    const trainer = {
      rank: 1,
      slug: "alice",
      displayName: "Alice",
      periodCaptures: 3,
      totalCaptures: 7,
    };
    const rankedEntry = { ...entry, rank: 1, metricValue: 42 };
    services.getTrainerRankingPage.mockResolvedValue({
      items: [trainer],
      total: 1,
      currentUser: null,
    });
    services.getEntryRankingPage.mockResolvedValue({ items: [rankedEntry], total: 1 });

    const [trainersResponse, entriesResponse] = await Promise.all([
      getTrainerRankings(
        new NextRequest(
          "https://poketerps.test/api/rankings/trainers?period=month&limit=10&offset=0",
        ),
      ),
      getEntryRankings(
        new NextRequest(
          "https://poketerps.test/api/rankings/entries?period=all&metric=likes&limit=10&offset=0",
        ),
      ),
    ]);

    expect(trainersResponse.status).toBe(200);
    expect(entriesResponse.status).toBe(200);
    expect(services.getTrainerRankingPage).toHaveBeenCalledWith("month", 10, 0, undefined);
    expect(services.getEntryRankingPage).toHaveBeenCalledWith("likes", "all", 10, 0);
    expect(await trainersResponse.json()).toEqual({
      data: [trainer],
      pagination: { limit: 10, offset: 0, total: 1 },
      currentUser: null,
    });
    expect(await entriesResponse.json()).toEqual({
      data: [rankedEntry],
      pagination: { limit: 10, offset: 0, total: 1 },
    });
  });

  it("includes the authenticated trainer's exact rank outside the current page", async () => {
    const actor = { id: "00000000-0000-4000-8000-000000000099" };
    const currentUser = {
      rank: 42,
      slug: "nico",
      displayName: "Nico",
      captures: 2,
      periodCaptures: 2,
      totalCaptures: 9,
    };
    services.getOptionalCurrentUser.mockResolvedValue(actor);
    services.getTrainerRankingPage.mockResolvedValue({
      items: [],
      total: 42,
      currentUser,
    });

    const response = await getTrainerRankings(
      new NextRequest(
        "https://poketerps.test/api/rankings/trainers?period=week&limit=20&offset=20",
      ),
    );

    expect(services.getTrainerRankingPage).toHaveBeenCalledWith("week", 20, 20, actor.id);
    expect(await response.json()).toEqual({
      data: [],
      pagination: { limit: 20, offset: 20, total: 42 },
      currentUser,
    });
  });
});
