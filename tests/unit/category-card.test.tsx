import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryCard } from "@/components/entries/category-card";

describe("category card", () => {
  it("uses a coherent vector icon and displays the real published entry count", () => {
    const markup = renderToStaticMarkup(
      <CategoryCard
        category={{
          id: "category-hash",
          slug: "hash",
          name: "Hash",
          description: "Hash et informations déclarées",
          icon: "🟤",
          entryCount: 2,
        }}
      />,
    );

    expect(markup).toContain("lucide-gem");
    expect(markup).toContain(">2 <");
    expect(markup).not.toContain("🟤");
  });
});
