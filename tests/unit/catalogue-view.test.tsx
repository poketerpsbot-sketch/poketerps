import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serverApi: vi.fn() }));

vi.mock("@/components/data/server-api", () => ({
  serverApi: mocks.serverApi,
  unwrapList: (payload: unknown, keys: string[] = []) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    for (const key of keys) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  },
}));

import { CatalogueView } from "@/components/entries/catalogue-view";

const categories = [
  { id: "fleur", slug: "fleur", name: "Fleur", entryCount: 3, subcategories: [] },
  {
    id: "hash",
    slug: "hash",
    name: "Hash",
    entryCount: 10,
    subcategories: [{ id: "bubble", slug: "bubble-hash", name: "Bubble Hash" }],
  },
  { id: "rosin", slug: "rosin", name: "Rosin", entryCount: 5, subcategories: [] },
];

beforeEach(() => {
  mocks.serverApi.mockImplementation(async (url: string) => {
    if (url === "/api/categories") return { data: { categories } };
    return {
      data: {
        entries: [],
        pagination: { total: 0, limit: 24, offset: 0 },
      },
    };
  });
});

describe("Explorer compact filters", () => {
  it("renders dynamic quick category chips with Toutes selected by default", async () => {
    const markup = renderToStaticMarkup(
      await CatalogueView({ searchParams: {}, showCategories: true }),
    );

    expect(markup).toContain('aria-label="Catégories rapides"');
    expect(markup).toContain('aria-current="page" href="/explorer">Toutes</a>');
    expect(markup).toContain('href="/explorer?category=hash"');
    expect(markup).toContain("Hash");
    expect(markup).toContain("10");
    expect(markup).toContain("Filtres avancés");
    expect(markup).not.toContain("category-grid");
  });

  it("synchronizes the active chip and advanced category filter", async () => {
    const markup = renderToStaticMarkup(
      await CatalogueView({
        searchParams: { category: "hash", subcategory: "bubble-hash", tag: "fruité" },
        showCategories: true,
      }),
    );

    expect(markup).toContain('class="explorer-category-chip is-active"');
    expect(markup).toContain('href="/explorer?tag=fruit%C3%A9&amp;category=rosin"');
    expect(markup).toContain('<option value="hash" selected="">Hash</option>');
    expect(markup).toContain('name="subcategory"');
    expect(markup).toContain('class="filter-panel__count">3</span>');
  });
});
