import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntryActions } from "@/components/entries/entry-actions";

describe("published entry sharing", () => {
  it("exposes native sharing and Telegram fallback only when enabled", () => {
    const published = renderToStaticMarkup(
      <EntryActions
        entryId="550e8400-e29b-41d4-a716-446655440000"
        slug="blue-zushi"
        entryName="Blue Zushi"
        shareDescription="Une description courte."
        telegramBotUsername="pokedex_test_bot"
        canShare
      />,
    );
    expect(published).toContain("Partager");
    expect(published).toContain("Partager sur Telegram");
    expect(published).toContain("t.me/share/url");
    expect(published).toContain(
      "pokedex_test_bot%3Fstart%3Dentry_550e8400-e29b-41d4-a716-446655440000",
    );

    const privateEntry = renderToStaticMarkup(
      <EntryActions entryId="entry-id" slug="draft" entryName="Brouillon" />,
    );
    expect(privateEntry).not.toContain("Partager sur Telegram");
  });
});
