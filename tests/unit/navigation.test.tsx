import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

import { BottomNav } from "@/components/layout/bottom-nav";
import { Topbar } from "@/components/layout/topbar";

describe("primary navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("places rankings immediately before partners on desktop", () => {
    const markup = renderToStaticMarkup(<Topbar />);
    const rankings = markup.indexOf('href="/classements"');
    const partners = markup.indexOf('href="/partenaires"');

    expect(rankings).toBeGreaterThan(-1);
    expect(partners).toBeGreaterThan(rankings);
    expect(markup.slice(rankings, partners)).toContain("Classements");
  });

  it("renders the exact seven-item mobile order with Add in the center", () => {
    const markup = renderToStaticMarkup(<BottomNav />);
    const expected = [
      ["/", "Accueil"],
      ["/explorer", "Explorer"],
      ["/concours", "Concours"],
      ["/capturer", "Ajouter"],
      ["/classements", "Classement"],
      ["/partenaires", "Partenaires"],
      ["/profil", "Profil"],
    ] as const;
    let cursor = -1;
    for (const [href, label] of expected) {
      const next = markup.indexOf(`href="${href}"`, cursor + 1);
      expect(next, label).toBeGreaterThan(cursor);
      expect(markup.slice(next, markup.indexOf("</a>", next))).toContain(label);
      cursor = next;
    }
    expect(markup.match(/class="bottom-nav__item/g)).toHaveLength(7);
    expect(markup.match(/bottom-nav__item--primary/g)).toHaveLength(1);
  });
});
