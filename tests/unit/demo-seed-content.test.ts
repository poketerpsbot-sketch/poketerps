import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DEMO_CATEGORY_SLUGS, DEMO_MEDIA_MANIFEST } from "../../scripts/demo-media-manifest";

type DemoSeed = {
  seed_key: string;
  short_description: string;
  full_description: string;
  declared_variety: string;
  declared_producer: string;
  method: string;
  texture: string;
  country: string | null;
  region: string | null;
  fields: Record<string, { value: unknown; display: string; option?: string }>;
};

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
const schema = read("../../supabase/schema.sql");
const initialMigration = read("../../supabase/migrations/001_initial_schema.sql");
const enrichmentMigration = read("../../supabase/migrations/002_enrich_demo_entries.sql");
const taxonomyMigration = read("../../supabase/migrations/004_taxonomy_measurements.sql");
const mediaSources = read("../../docs/DEMO_MEDIA_SOURCES.md");
const payload = enrichmentMigration.match(/\$demo\$([\s\S]*?)\$demo\$/)?.[1];
if (!payload) throw new Error("Demo seed JSON is missing from the enrichment migration.");
const demoSeeds = JSON.parse(payload) as DemoSeed[];

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

describe("demo catalogue enrichment", () => {
  it("keeps exactly two entries in every category", () => {
    expect(DEMO_CATEGORY_SLUGS).toHaveLength(9);
    expect(demoSeeds).toHaveLength(18);
    expect(DEMO_MEDIA_MANIFEST).toHaveLength(18);
    expect(uniqueCount(demoSeeds.map((entry) => entry.seed_key))).toBe(18);
    expect(new Set(DEMO_MEDIA_MANIFEST.map((item) => item.seedKey))).toEqual(
      new Set(demoSeeds.map((entry) => entry.seed_key)),
    );

    for (const category of DEMO_CATEGORY_SLUGS) {
      expect(DEMO_MEDIA_MANIFEST.filter((item) => item.categorySlug === category)).toHaveLength(2);
    }
  });

  it("provides substantial fictional descriptions and coherent declared fields", () => {
    for (const entry of demoSeeds) {
      expect(entry.short_description.length, entry.seed_key).toBeGreaterThanOrEqual(80);
      expect(entry.full_description.length, entry.seed_key).toBeGreaterThanOrEqual(240);
      expect(entry.full_description.split("\n\n"), entry.seed_key).toHaveLength(2);
      expect(entry.declared_variety, entry.seed_key).toMatch(/ficti|composition/i);
      expect(entry.declared_producer, entry.seed_key).toBe("Non attribué — fiche fictive");
      expect(entry.method.length, entry.seed_key).toBeGreaterThan(20);
      expect(entry.texture, entry.seed_key).toMatch(/illustration/i);
      expect(entry.country, entry.seed_key).toBeNull();
      expect(entry.region, entry.seed_key).toBeNull();
      expect(Object.keys(entry.fields).length, entry.seed_key).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not introduce commercial links, prices, instructions, or medical claims", () => {
    const editorialContent = JSON.stringify(demoSeeds);
    expect(editorialContent).not.toMatch(/https?:\/\/|€|CHF|\$\d|acheter|commander|livraison/i);
    expect(editorialContent).not.toMatch(
      /étape\s+\d|température\s+de|pendant\s+\d+\s*(minute|heure)/i,
    );

    expect(demoSeeds.some((entry) => entry.seed_key.startsWith("demo.medicinal."))).toBe(false);
    expect(DEMO_CATEGORY_SLUGS).not.toContain("medicinal");
  });

  it("uses deterministic, reusable Wikimedia sources with complete attribution", () => {
    expect(uniqueCount(DEMO_MEDIA_MANIFEST.map((item) => item.entryId))).toBe(18);
    expect(uniqueCount(DEMO_MEDIA_MANIFEST.map((item) => item.imageId))).toBe(18);
    expect(uniqueCount(DEMO_MEDIA_MANIFEST.map((item) => item.objectPath))).toBe(18);
    expect(uniqueCount(DEMO_MEDIA_MANIFEST.map((item) => item.commonsFileTitle))).toBe(18);

    for (const item of DEMO_MEDIA_MANIFEST) {
      expect(item.objectPath).toBe(`demo/${item.entryId}.webp`);
      expect(item.objectPath).toMatch(
        /^demo\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}\.webp$/,
      );
      expect(item.sourcePage).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(item.licenseUrl).toMatch(/^https:\/\//);
      expect(item.author.trim().length).toBeGreaterThan(0);
      expect(item.altText).toMatch(/^Photo d’illustration/);
      expect(item.licenseName).not.toMatch(/NC|ND/);
      expect(mediaSources).toContain(item.seedKey);
      expect(mediaSources).toContain(item.sourcePage);
      expect(mediaSources).toContain(item.author);
    }
  });

  it("keeps fresh installs and upgrades guarded and idempotent", () => {
    expect(schema).not.toBe(initialMigration);
    expect(schema).toContain("-- Evolution 006: avis, notifications, concours configurables");
    expect(initialMigration).not.toContain("review_moderation_events");
    expect(enrichmentMigration).toMatch(/where e\.seed_key = content\.seed_key\s+and e\.is_demo/i);
    expect(enrichmentMigration).toMatch(/on conflict\(entry_id,field_definition_id\) do update/i);
    expect(enrichmentMigration).toMatch(/add column if not exists source_url/i);
    expect(enrichmentMigration).toMatch(/entry_images_attribution_consistency/i);
    expect(enrichmentMigration).not.toMatch(/insert into public\.entries/i);
    expect(taxonomyMigration).toMatch(/demo\.medicinal\.oil[\s\S]*demo\.medicinal\.capsules/i);
    expect(taxonomyMigration).toMatch(/status = 'DELETED'::public\.entry_status/i);
    expect(taxonomyMigration).toMatch(/where slug = 'medicinal'/i);
    expect(taxonomyMigration).toMatch(/'mL'/);
    expect(taxonomyMigration).not.toMatch(/'NUMBER','ml'/);
  });
});
