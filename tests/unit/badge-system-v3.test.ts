import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const migration = read("supabase/migrations/20260926220000_badge_system_v3.sql");
const entriesService = read("src/lib/services/entries.ts");
const schema = read("supabase/schema.sql");

describe("badge system V3", () => {
  it("defines the complete additive contributor progression", () => {
    for (const threshold of [5, 10, 25, 50, 100, 250]) {
      expect(migration).toContain(`captures-${threshold}`);
      expect(migration).toContain(`'threshold',${threshold}`);
    }

    expect(migration).toMatch(/on conflict do nothing/i);
    expect(migration).not.toMatch(/\b(drop|delete|truncate)\b/i);
    expect(schema).toContain("-- Evolution badges V3 : une famille visuelle commune");
  });

  it("awards every progression tier from published non-demo entries", () => {
    expect(entriesService).toContain("for (const milestone of [5, 10, 25, 50, 100, 250] as const)");
    expect(entriesService).toContain('eq(entries.status, "PUBLISHED")');
    expect(entriesService).toContain("eq(entries.isDemo, false)");
    expect(entriesService).toContain("slug: `captures-${milestone}`");
  });
});
