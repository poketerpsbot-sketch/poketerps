import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/services/reviews.ts"), "utf8");

describe("review persistence contract", () => {
  it("versions every resubmission, closes the active request and returns to moderation", () => {
    expect(source).toMatch(/insert\(reviewVersions\)[\s\S]*ratingsSnapshot: input\.ratings/i);
    expect(source).toMatch(
      /update review_moderation_events[\s\S]*resolved_at=now\(\)[\s\S]*action='CHANGES_REQUESTED'/i,
    );
    expect(source).toMatch(
      /insert into review_moderation_events[\s\S]*'RESUBMITTED'[\s\S]*'PENDING_REVIEW'/i,
    );
    expect(source).toMatch(/status: "PENDING_REVIEW"/i);
    expect(source).toMatch(/REVIEW_RESUBMITTED/);
  });

  it("keeps personal reads and edits scoped to the authenticated internal user", () => {
    expect(source).toMatch(
      /eq\(reviews\.id, id\), eq\(reviews\.userId, actor\.id\), isNull\(reviews\.deletedAt\)/,
    );
    expect(source).toMatch(/review\.status !== "CHANGES_REQUESTED"/);
    expect(source).toMatch(/INVALID_REVIEW_RATINGS/);
  });

  it("publishes approvals and persists user notifications before Telegram delivery", () => {
    expect(source).toMatch(/input\.status === "APPROVED" \? "PUBLISHED"/);
    expect(source).toMatch(/insert\(userNotifications\)/);
    expect(source).toMatch(/sendReviewStatusTelegram/);
    expect(source.indexOf("insert(userNotifications)")).toBeLessThan(
      source.lastIndexOf("sendReviewStatusTelegram"),
    );
  });
});
