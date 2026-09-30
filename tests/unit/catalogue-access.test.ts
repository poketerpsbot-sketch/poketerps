import { describe, expect, it } from "vitest";

import { canViewEntry } from "@/lib/services/catalogue";

const entry = (status: "DRAFT" | "PENDING_REVIEW" | "CHANGES_REQUESTED" | "PUBLISHED") => ({
  status,
  createdById: "author-id",
});

describe("catalogue entry visibility", () => {
  it("keeps published entries public", () => {
    expect(canViewEntry(entry("PUBLISHED"), null)).toBe(true);
  });

  it("lets a moderator preview moderation states without making drafts public", () => {
    const moderator = { id: "moderator-id", role: "MODERATOR" as const };

    expect(canViewEntry(entry("PENDING_REVIEW"), moderator)).toBe(true);
    expect(canViewEntry(entry("CHANGES_REQUESTED"), moderator)).toBe(true);
    expect(canViewEntry(entry("DRAFT"), moderator)).toBe(false);
    expect(canViewEntry(entry("PENDING_REVIEW"), null)).toBe(false);
  });

  it("keeps author and any-entry authority behavior intact", () => {
    expect(canViewEntry(entry("DRAFT"), { id: "author-id", role: "MEMBER" })).toBe(true);
    expect(canViewEntry(entry("DRAFT"), { id: "admin-id", role: "ADMIN" })).toBe(true);
    expect(canViewEntry(entry("PENDING_REVIEW"), { id: "other-id", role: "MEMBER" })).toBe(false);
  });
});
