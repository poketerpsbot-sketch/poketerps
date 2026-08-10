import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArchiveLoadingScreen } from "@/components/ui/archive-loading-screen";

describe("ArchiveLoadingScreen", () => {
  it("announces a branded, accessible loading state", () => {
    const markup = renderToStaticMarkup(<ArchiveLoadingScreen />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Connexion aux archives");
    expect(markup).toContain("Synchronisation des captures et de la taxonomie");
    expect(markup).toContain("archive-loading__scan");
    expect(markup).toContain("pokeball");
  });
});
