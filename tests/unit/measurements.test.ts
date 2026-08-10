import { describe, expect, it } from "vitest";

import { isMicronApplicable } from "@/lib/taxonomy/measurements";

describe("product measurement rules", () => {
  it("allows micron values only for sift, filtered hash and rosin products", () => {
    expect(isMicronApplicable("hash", "dry-sift")).toBe(true);
    expect(isMicronApplicable("hash", "bubble-hash")).toBe(true);
    expect(isMicronApplicable("rosin", "hash-rosin")).toBe(true);
    expect(isMicronApplicable("concentres-sans-solvant", "static-sift")).toBe(true);
  });

  it("rejects micron values for unrelated or unspecified products", () => {
    expect(isMicronApplicable("fleur", "indoor")).toBe(false);
    expect(isMicronApplicable("vape", "cartridge-510")).toBe(false);
    expect(isMicronApplicable("edibles", "gummies")).toBe(false);
    expect(isMicronApplicable("hash", "charas")).toBe(false);
    expect(isMicronApplicable("hash", null)).toBe(false);
  });
});
