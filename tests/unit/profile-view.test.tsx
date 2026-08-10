import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MyProfileView,
  extractProfilePayload,
  type ProfilePayload,
} from "@/components/profiles/profile-view";

describe("profile dashboard", () => {
  it("normalizes the private profile envelope without losing activity collections", () => {
    const profile = extractProfilePayload({
      profile: {
        displayName: "Nico",
        slug: "nico",
        username: "nico_tg",
        ranks: { allRank: 3, monthRank: 2, weekRank: 1, totalCaptures: 7 },
      },
      entries: [{ id: "entry-1", slug: "one", name: "One" }],
      publishedEntries: [{ id: "entry-2", slug: "two", name: "Two" }],
      likedEntries: [{ id: "entry-3", slug: "three", name: "Three" }],
      recentViews: [{ id: "entry-4", slug: "four", name: "Four" }],
      telegramIdentity: { displayName: "Nicolas", username: "nico_tg" },
      stats: { entriesAdded: 12, likes: 5 },
    });

    expect(profile).toMatchObject({
      displayName: "Nico",
      publicSlug: "nico",
      telegramUsername: "nico_tg",
      rankOverall: 3,
      rankMonth: 2,
      rankWeek: 1,
      captureCount: 7,
      telegramIdentity: { displayName: "Nicolas", username: "nico_tg" },
      stats: { entriesAdded: 12, likes: 5 },
    });
    expect(profile?.entries).toHaveLength(1);
    expect(profile?.publishedEntries).toHaveLength(1);
    expect(profile?.likedEntries).toHaveLength(1);
    expect(profile?.recentViews).toHaveLength(1);
  });

  it.each(["OWNER", "ADMIN"] as const)("shows the web admin entry point to %s", (role) => {
    const profile: ProfilePayload = { displayName: "Admin", role };
    const html = renderToStaticMarkup(<MyProfileView profile={profile} />);

    expect(html).toContain('href="/admin"');
    expect(html).toContain("Panneau d’administration");
  });

  it.each(["MODERATOR", "EDITOR", "MEMBER"] as const)(
    "does not advertise the web admin entry point to %s",
    (role) => {
      const profile: ProfilePayload = { displayName: "Membre", role };
      const html = renderToStaticMarkup(<MyProfileView profile={profile} />);

      expect(html).not.toContain('href="/admin"');
      expect(html).not.toContain("Panneau d’administration");
    },
  );
});
