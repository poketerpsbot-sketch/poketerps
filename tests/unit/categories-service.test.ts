import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("@/lib/db", () => ({ getDb: mocks.getDb }));

import { listCategories } from "@/lib/services/categories";

function queryBuilder(rows: unknown[], terminalMethod: "orderBy" | "groupBy") {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["from", "innerJoin", "where", "orderBy", "groupBy"]) {
    builder[method] = vi.fn(() => (method === terminalMethod ? rows : builder));
  }
  return builder;
}

describe("category entry counts", () => {
  beforeEach(() => mocks.getDb.mockReset());

  it("merges the grouped published-entry counts and keeps empty categories at zero", async () => {
    const flowerId = "00000000-0000-4000-8000-000000000001";
    const vapeId = "00000000-0000-4000-8000-000000000002";
    const select = vi
      .fn()
      .mockReturnValueOnce(
        queryBuilder(
          [
            {
              id: flowerId,
              slug: "fleur",
              name: "Fleur",
              description: null,
              icon: null,
              sortOrder: 10,
            },
            {
              id: vapeId,
              slug: "vape",
              name: "Vape",
              description: null,
              icon: null,
              sortOrder: 20,
            },
          ],
          "orderBy",
        ),
      )
      .mockReturnValueOnce(queryBuilder([], "orderBy"))
      .mockReturnValueOnce(queryBuilder([], "orderBy"))
      .mockReturnValueOnce(queryBuilder([], "orderBy"))
      .mockReturnValueOnce(queryBuilder([{ categoryId: flowerId, entryCount: "2" }], "groupBy"))
      .mockReturnValueOnce(queryBuilder([], "orderBy"));
    mocks.getDb.mockReturnValue({ select });

    const result = await listCategories();

    expect(result.map(({ slug, entryCount }) => ({ slug, entryCount }))).toEqual([
      { slug: "fleur", entryCount: 2 },
      { slug: "vape", entryCount: 0 },
    ]);
  });
});
