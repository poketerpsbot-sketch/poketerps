import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

describe("admin user and team mobile CSS", () => {
  it("uses constrained responsive grids and wrapped text", () => {
    expect(css).toMatch(/\.admin-user-stat-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.admin-user-history-grid[\s\S]*min-width: 0/);
    expect(css).toMatch(/\.admin-history-row strong[\s\S]*overflow-wrap: anywhere/);
  });

  it("stacks team controls and audit actions on narrow phones", () => {
    expect(css).toMatch(
      /@media \(max-width: 430px\)[\s\S]*\.admin-team-filters \.button[\s\S]*width: 100%/,
    );
    expect(css).toMatch(/\.admin-team-member-list dl[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.admin-audit-detail__diff pre[\s\S]*overflow-wrap: anywhere/);
    expect(css).toMatch(/\.admin-team-permission-list \.button[\s\S]*min-height: 42px/);
    expect(css).toMatch(/\.admin-user-contribution-grid[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.admin-session-overview[\s\S]*min-width: 0/);
  });
});
