import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntryActions } from "@/components/entries/entry-actions";

describe("published entry sharing", () => {
  it("exposes native sharing and Telegram fallback only when enabled", () => {
    const published = renderToStaticMarkup(
      <EntryActions
        entryId="entry-id"
        slug="blue-zushi"
        entryName="Blue Zushi"
        shareDescription="Une description courte."
        canShare
      />,
    );
    expect(published).toContain("Partager");
    expect(published).toContain("Partager sur Telegram");
    expect(published).toContain("t.me/share/url");

    const privateEntry = renderToStaticMarkup(
      <EntryActions entryId="entry-id" slug="draft" entryName="Brouillon" />,
    );
    expect(privateEntry).not.toContain("Partager sur Telegram");
  });
});
