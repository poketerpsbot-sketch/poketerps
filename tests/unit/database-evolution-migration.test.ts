import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/006_navigation_reviews_contests_team_activity.sql");
const schema = read("supabase/schema.sql");
const drizzle = read("src/lib/db/schema.ts");

describe("database evolution 006", () => {
  it("keeps review moderation and user notifications relational and private", () => {
    expect(migration).toMatch(/create table if not exists public\.review_moderation_events/i);
    expect(migration).toMatch(/create table if not exists public\.user_notifications/i);
    expect(migration).toMatch(
      /review_moderation_events_one_open_change_idx[\s\S]*action='CHANGES_REQUESTED'[\s\S]*resolved_at is null/i,
    );
    expect(migration).toMatch(
      /action not in \('CHANGES_REQUESTED','REJECTED'\)[\s\S]*char_length\(btrim\(message\)\)/i,
    );
    expect(migration).toMatch(/review_versions[\s\S]*ratings_snapshot jsonb not null/i);
    expect(migration).toMatch(/alter table public\.user_notifications enable row level security/i);
    expect(migration).not.toMatch(/create policy[\s\S]{0,200}on public\.user_notifications/i);
  });

  it("serializes the final contest place and exposes configurable instructions", () => {
    expect(migration).toMatch(/add column if not exists instructions text not null/i);
    expect(migration).toMatch(/participation_steps jsonb not null/i);
    expect(migration).toMatch(
      /external_url text[\s\S]*telegram_url text[\s\S]*instagram_url text/i,
    );
    expect(migration).toMatch(
      /function public\.enforce_contest_participation_quota\(\)[\s\S]*for update[\s\S]*occupied_places>=contest_row\.max_participants/i,
    );
    expect(migration).toMatch(
      /if tg_op='UPDATE'[\s\S]*old\.status not in \('REJECTED','WITHDRAWN','DISQUALIFIED'\)[\s\S]*return new/i,
    );
    expect(migration).toMatch(
      /create trigger enforce_contest_participation_quota before insert or update of status,contest_id/i,
    );
    expect(migration).toMatch(
      /create trigger sync_contest_full_status after insert or delete or update of status,contest_id/i,
    );
    expect(migration).toMatch(
      /function public\.join_contest\([\s\S]*insert into public\.contest_participations/i,
    );
    expect(schema).toMatch(
      /contest_participations_contest_user_unique unique\(contest_id,user_id\)/i,
    );
  });

  it("tracks only Poketerps sessions, activity, moderation and team audit data", () => {
    for (const table of [
      "user_sessions",
      "user_activity_events",
      "admin_outbound_messages",
      "user_moderation_events",
      "admin_user_notes",
      "role_history",
      "user_permissions",
    ]) {
      expect(migration).toContain(`public.${table}`);
      expect(drizzle).toContain(`"${table}"`);
    }
    expect(migration).toMatch(/add column if not exists actor_role public\.user_role/i);
    expect(migration).toMatch(/audit_logs_action_created_idx/i);
    expect(migration).toMatch(/audit_logs_actor_role_created_idx/i);
    expect(migration).toContain("'VIEW_ADMIN_ACTIVITY'");
    expect(migration).toContain("'VIEW_MODERATOR_ACTIVITY'");
    expect(migration).toContain("'VIEW_TEAM_AUDIT_LOG'");
  });

  it("separates collection microns from pressing-bag microns without deleting legacy data", () => {
    expect(migration).toMatch(
      /create type public\.micron_context_type as enum\s*\('COLLECTION_SEPARATION','PRESSING_BAG'\)/i,
    );
    expect(migration).toMatch(/create table if not exists public\.entry_micron_contexts/i);
    expect(migration).toMatch(/create table if not exists public\.subcategory_micron_presets/i);
    expect(migration).toMatch(/unique\(entry_id,context\)/i);
    expect(migration).toMatch(
      /from public\.micron_specifications m\s*on conflict\(entry_id,context\) do nothing/i,
    );
    expect(migration).not.toMatch(
      /drop table|truncate table|delete from public\.micron_specifications/i,
    );
    expect(migration).toMatch(/'bubble','220-um'[\s\S]*'dry','250-um'/i);
    expect(migration).toMatch(
      /'hash_rosin','pressing-bag-25-um'[\s\S]*'flower_rosin','pressing-bag-160-um'/i,
    );
    expect(migration).toMatch(
      /c\.slug='rosin'[\s\S]*s\.slug in \('dry-sift-rosin','bubble-hash-rosin'\)[\s\S]*create table if not exists public\.subcategory_micron_presets/i,
    );
    expect(migration).toMatch(
      /micron_requirement='OPTIONAL'[\s\S]*array\['COLLECTION_SEPARATION','PRESSING_BAG'\]::public\.micron_context_type\[\]/i,
    );
  });

  it("seeds the requested dry/static/traditional hash taxonomy without inventing microns", () => {
    for (const slug of [
      "frozen-dry-sift",
      "static-tech",
      "dry-sift-presse",
      "dry-sift-non-presse",
      "full-spectrum-dry-sift",
      "single-fraction",
      "mixed-fraction",
      "pressed-hash",
      "pollen-kief-presse",
    ]) {
      expect(migration).toContain(`'${slug}'`);
    }
    expect(migration).toMatch(/\('dry','hash','frozen-dry-sift'\)/i);
    expect(migration).toMatch(/\('static','hash','static-tech'\)/i);
    expect(migration).not.toMatch(/\('[^']+','hash','(?:pressed-hash|pollen-kief-presse)'\)/i);
  });

  it("adds contextual starting-material state and the missing Rosin textures", () => {
    expect(migration).toMatch(
      /'starting_material_state','État de la matière de départ'[\s\S]*'fresh-frozen'[\s\S]*'Matière fraîche congelée rapidement après récolte\.'/i,
    );
    expect(migration).toMatch(/\('extractions-solvants','live-resin',35\)/i);
    expect(migration).toMatch(/\('rosin','live-rosin',35\)/i);
    expect(migration).toMatch(/'sauce-like','Sauce-like'[\s\S]*'autre','Autre'/i);
    expect(migration).toContain("Texture obtenue après maturation à froid");
  });

  it("keeps the full schema mirror synchronized", () => {
    for (const marker of [
      "review_moderation_events",
      "user_notifications",
      "entry_micron_contexts",
      "subcategory_micron_presets",
      "enforce_contest_participation_quota",
      "VIEW_TEAM_AUDIT_LOG",
    ]) {
      expect(schema).toContain(marker);
      expect(migration).toContain(marker);
    }
  });
});
