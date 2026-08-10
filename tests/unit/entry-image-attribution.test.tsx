import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntryDetail } from "@/components/entries/entry-detail";

describe("entry image attribution", () => {
  it("renders visible, linked attribution and the derivative notice", () => {
    const markup = renderToStaticMarkup(
      <EntryDetail
        entry={{
          id: "10000000-0000-4000-8000-000000000001",
          slug: "demo-fleur-indoor",
          name: "Démonstration — Fleur Indoor",
          images: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              url: "/demo.webp",
              altText: "Photo d’illustration : plante de cannabis sous une lampe.",
              isPrimary: true,
              sourceUrl:
                "https://commons.wikimedia.org/wiki/File:Cannabis_plant_below_a_grow_light.jpg",
              credit: "Cannabis Tours",
              licenseName: "CC BY-SA 4.0",
              licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
            },
          ],
        }}
        reviews={[]}
      />,
    );

    expect(markup).toContain("Photo d’illustration");
    expect(markup).toContain("Crédit : Cannabis Tours");
    expect(markup).toContain("CC BY-SA 4.0");
    expect(markup).toContain("Source Wikimedia Commons");
    expect(markup).toContain("redimensionnée et convertie en WebP");
    expect(markup).toContain("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(markup).toContain(
      "https://commons.wikimedia.org/wiki/File:Cannabis_plant_below_a_grow_light.jpg",
    );
  });
});
