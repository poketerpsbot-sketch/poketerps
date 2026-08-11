import { describe, expect, it } from "vitest";

import { micronProfilesFor } from "@/lib/taxonomy/micron-contexts";

describe("contextual micron profiles", () => {
  it("uses collection fractions for bubble hash", () => {
    const profiles = micronProfilesFor("hash", "bubble-hash");
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.context).toBe("COLLECTION_SEPARATION");
    expect(profiles[0]?.presets.some((preset) => preset.label === "73–159 µm")).toBe(true);
  });

  it("keeps hash fraction and pressing bag separate for hash rosin", () => {
    const profiles = micronProfilesFor("rosin", "hash-rosin");
    expect(profiles.map((profile) => profile.context)).toEqual([
      "COLLECTION_SEPARATION",
      "PRESSING_BAG",
    ]);
    expect(profiles[1]?.presets.some((preset) => preset.label === "25 µm")).toBe(true);
  });

  it("offers flower-specific pressing bags without a collection micron", () => {
    const profiles = micronProfilesFor("rosin", "flower-rosin");
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.context).toBe("PRESSING_BAG");
    expect(profiles[0]?.presets.map((preset) => preset.label)).toContain("160 µm");
  });

  it("never adds microns to traditional hash or flower", () => {
    expect(micronProfilesFor("hash", "moroccan-hash")).toEqual([]);
    expect(micronProfilesFor("hash", "pressed-hash")).toEqual([]);
    expect(micronProfilesFor("hash", "pollen-kief-presse")).toEqual([]);
    expect(micronProfilesFor("fleur", "indoor")).toEqual([]);
  });

  it("covers every configured dry/static subtype with collection microns only", () => {
    for (const slug of [
      "frozen-dry-sift",
      "dry-sift-presse",
      "dry-sift-non-presse",
      "full-spectrum-dry-sift",
      "single-fraction",
      "mixed-fraction",
      "static-tech",
    ]) {
      expect(micronProfilesFor("hash", slug).map((profile) => profile.context)).toEqual([
        "COLLECTION_SEPARATION",
      ]);
    }
  });

  it("treats database mappings as authoritative and deduplicates NONE options", () => {
    const profiles = micronProfilesFor("hash", "bubble-hash", [
      {
        id: "preset-73",
        slug: "73-um",
        context: "COLLECTION_SEPARATION",
        mode: "SINGLE",
        label: "73 µm",
        singleValue: 73,
      },
      {
        id: "none-1",
        slug: "not-specified",
        context: "COLLECTION_SEPARATION",
        mode: "NONE",
        label: "Non précisé",
      },
      {
        id: "none-2",
        slug: "another-not-specified",
        context: "COLLECTION_SEPARATION",
        mode: "NONE",
        label: "Inconnu",
      },
    ]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.presets.filter((preset) => preset.value === "none")).toHaveLength(1);
    expect(profiles[0]?.presets.some((preset) => preset.label === "220 µm")).toBe(false);
  });

  it("honors an empty mapping and exposes only configured custom values", () => {
    expect(micronProfilesFor("rosin", "flower-rosin", [])).toEqual([]);
    const profiles = micronProfilesFor("rosin", "flower-rosin", [
      {
        id: "preset-90",
        slug: "pressing-bag-90-um",
        context: "PRESSING_BAG",
        mode: "SINGLE",
        label: "90 µm",
        singleValue: 90,
      },
      {
        id: "preset-custom",
        slug: "pressing-bag-custom",
        context: "PRESSING_BAG",
        mode: "NONE",
        label: "Autre",
      },
    ]);
    expect(profiles[0]?.presets.map((preset) => preset.label)).toEqual(["Non précisé", "90 µm"]);
    expect(profiles[0]?.allowCustomRange).toBe(true);
  });
});
