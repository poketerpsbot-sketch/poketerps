import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");
const migration = read("supabase/migrations/005_role_badges.sql");
const schema = read("supabase/schema.sql");
const initialMigration = read("supabase/migrations/001_initial_schema.sql");
const profileService = read("src/lib/services/profiles.ts");
const profileView = read("src/components/profiles/profile-view.tsx");

const roleSlugs = ["role-owner", "role-admin", "role-moderator", "role-editor"];

describe("automatic Telegram role badges", () => {
  it("seeds every managed team role in upgrades and fresh installs", () => {
    for (const slug of roleSlugs) {
      expect(migration).toContain(`'${slug}'`);
      expect(schema).toContain(`'${slug}'`);
      expect(initialMigration).toContain(`'${slug}'`);
    }

    expect(migration).toMatch(/"system":"telegram-role"/);
    expect(migration).toMatch(/on conflict\(slug\) do update/i);
    expect(schema).not.toBe(initialMigration);
    expect(schema).toContain("-- Evolution 006: avis, notifications, concours configurables");
    expect(initialMigration).not.toContain("review_moderation_events");
  });

  it("uses a locked-down trigger to reconcile inserts and role changes", () => {
    expect(migration).toMatch(
      /function public\.sync_user_role_badge\(\)[\s\S]*security definer[\s\S]*set search_path\s*=\s*''/i,
    );
    expect(migration).toMatch(/after insert or update of role on public\.users/i);
    expect(migration).toMatch(/set is_active=false,[\s\S]*revoked_at=coalesce/i);
    expect(migration).toMatch(/insert into public\.user_badges/i);
    expect(migration).toMatch(
      /revoke all on function public\.sync_user_role_badge\(\) from public,anon,authenticated/i,
    );
    expect(migration).not.toMatch(
      /grant execute on function public\.sync_user_role_badge\(\) to (?:anon|authenticated)/i,
    );
  });

  it("keeps the existing profile badge pipeline connected to user_badges", () => {
    expect(profileService).toMatch(/\.from\(userBadges\)/);
    expect(profileService).toMatch(/\.innerJoin\(badges,/);
    expect(profileService).toMatch(/eq\(userBadges\.isActive, true\)/);
    expect(profileView).toMatch(/function BadgeGallery/);
    expect(profileView).toMatch(/<BadgeGallery badges=\{badges\}/);
  });
});
