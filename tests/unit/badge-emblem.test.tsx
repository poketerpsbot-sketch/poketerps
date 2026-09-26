import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BadgeEmblem, badgeVisualFor } from "@/components/ui/badge-emblem";
import { RoleBadge } from "@/components/ui/role-badge";

describe("Poketerps badge system", () => {
  it("keeps role badges visually distinct and ordered by responsibility", () => {
    expect(badgeVisualFor({ role: "OWNER" })).toMatchObject({
      family: "role",
      tier: 5,
    });
    expect(badgeVisualFor({ role: "MEMBER" })).toMatchObject({
      family: "role",
      tier: 1,
    });

    const html = renderToStaticMarkup(<RoleBadge role="OWNER" />);
    expect(html).toContain("badge-emblem--role-owner");
    expect(html).toContain("Propriétaire");
  });

  it.each([
    ["captures-5", 1],
    ["captures-10", 2],
    ["captures-25", 3],
    ["captures-50", 4],
    ["captures-100", 5],
    ["captures-250", 6],
  ])("maps %s to contribution tier %i", (slug, tier) => {
    expect(badgeVisualFor({ badge: { slug, category: "ACHIEVEMENT" } })).toMatchObject({
      family: "contribution",
      tier,
    });
  });

  it("prefers the configured criteria tier for future badge additions", () => {
    const html = renderToStaticMarkup(
      <BadgeEmblem
        badge={{
          name: "Contribution personnalisée",
          slug: "custom-contribution",
          category: "ACHIEVEMENT",
          criteria: { family: "entry-contribution", tier: 4 },
        }}
        size="card"
      />,
    );

    expect(html).toContain("badge-emblem--contribution");
    expect(html).toContain("badge-emblem--tier-4");
  });
});
