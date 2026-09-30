import { describe, expect, it } from "vitest";

import { safeInternalHref, withReturnTo } from "@/lib/navigation";

describe("internal return navigation", () => {
  it("adds an encoded return target without losing the destination", () => {
    expect(withReturnTo("/fiches/hash-rosin", "/explorer?category=hash&page=2")).toBe(
      "/fiches/hash-rosin?returnTo=%2Fexplorer%3Fcategory%3Dhash%26page%3D2",
    );
  });

  it("accepts only local return targets and falls back safely", () => {
    expect(safeInternalHref("/admin/fiches#corrections", "/explorer")).toBe(
      "/admin/fiches#corrections",
    );
    expect(safeInternalHref("https://example.com", "/explorer")).toBe("/explorer");
    expect(safeInternalHref("//example.com", "/explorer")).toBe("/explorer");
    expect(safeInternalHref(null, "/explorer")).toBe("/explorer");
  });
});
