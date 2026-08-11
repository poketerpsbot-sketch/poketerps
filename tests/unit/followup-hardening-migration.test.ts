import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/007_followup_hardening.sql");
const schema = read("supabase/schema.sql");

describe("database follow-up hardening 007", () => {
  it("rejects a capacity below the real occupied count", () => {
    expect(migration).toMatch(/function public\.enforce_contest_capacity_floor\(\)/i);
    expect(migration).toMatch(
      /before update of max_participants[\s\S]*execute function public\.enforce_contest_capacity_floor/i,
    );
    expect(migration).toMatch(
      /p\.status in \('PENDING_REVIEW','APPROVED'\)[\s\S]*contest_capacity_below_occupied/i,
    );
    expect(migration).toMatch(/errcode='23514'/i);
  });

  it("uses one occupied-status definition for every quota counter", () => {
    const occupiedPredicates = migration.match(/p\.status in \('PENDING_REVIEW','APPROVED'\)/g);
    expect(occupiedPredicates).toHaveLength(4);
    expect(migration).toContain("create or replace function public.contest_participant_count");
    expect(migration).toContain("create or replace function public.sync_contest_full_status");
  });

  it("adds Ice Hash with translations, contextual fields and collection presets", () => {
    expect(migration).toMatch(/'ice-hash','Ice Hash','Hash séparé mécaniquement à l’eau glacée'/i);
    expect(migration).toMatch(
      /micron_requirement='OPTIONAL'[\s\S]*allowed_micron_contexts=array\['COLLECTION_SEPARATION'\]/i,
    );
    expect(migration).toMatch(/\('hash','ice-hash'\),\('concentres-sans-solvant','ice-hash'\)/i);
    expect(migration).toMatch(/'collection-custom'[\s\S]*'not-specified'/i);
    expect(migration).toMatch(
      /'starting_material_state','État de la matière de départ'[\s\S]*'fresh-frozen'/i,
    );
  });

  it("keeps the fresh schema mirror synchronized", () => {
    const marker = "create or replace function public.enforce_contest_capacity_floor()";
    const start = schema.lastIndexOf(marker);
    const nextMigration = schema.indexOf("-- Evolution 008:", start);
    const schemaBody = schema
      .slice(start, nextMigration)
      .trimEnd()
      .replace(/\ncommit;$/, "");
    const migrationBody = migration
      .slice(migration.lastIndexOf(marker), migration.lastIndexOf("\ncommit;"))
      .trimEnd();
    expect(schemaBody).toBe(migrationBody);
  });
});
