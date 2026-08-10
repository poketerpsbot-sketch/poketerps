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

  it("exposes rankings next to partners in the mobile tab bar", () => {
    const markup = renderToStaticMarkup(<BottomNav />);
    const rankings = markup.indexOf('href="/classements"');
    const partners = markup.indexOf('href="/partenaires"');

    expect(rankings).toBeGreaterThan(-1);
    expect(partners).toBeGreaterThan(rankings);
    expect(markup.slice(rankings, partners)).toContain("Classement");
  });
});
