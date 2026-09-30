import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { zonedDateTimeToUtc } from "@/lib/timezone";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Telegram publication scheduler contract", () => {
  it("converts Europe/Zurich local scheduling time to UTC across DST", () => {
    expect(zonedDateTimeToUtc("2026-09-30T15:35", "Europe/Zurich").toISOString()).toBe(
      "2026-09-30T13:35:00.000Z",
    );
    expect(zonedDateTimeToUtc("2026-01-15T15:35", "Europe/Zurich").toISOString()).toBe(
      "2026-01-15T14:35:00.000Z",
    );
  });

  it("keeps the Render cron, worker command and announcement queue wired together", () => {
    const render = read("render.yaml");
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const publications = read("src/lib/services/publications.ts");
    const broadcasts = read("src/lib/services/telegram-entry-broadcasts.ts");
    const migration = read("supabase/migrations/20260930123000_telegram_publication_scheduler.sql");

    expect(render).toMatch(/type: cron/);
    expect(render).toMatch(/schedule: "\*\/1 \* \* \* \*"/);
    expect(render).toContain("startCommand: npm run telegram:publish-scheduled");
    expect(packageJson.scripts["telegram:publish-scheduled"]).toContain(
      "process-telegram-publications.ts",
    );
    expect(publications).toMatch(/eq\(telegramPublications\.status, "SCHEDULED"\)/);
    expect(publications).toMatch(/lte\(telegramPublications\.scheduledAt, new Date\(\)\)/);
    expect(publications).toContain('type: "ANNOUNCEMENT"');
    expect(publications).toContain("prepareAnnouncementBroadcast");
    expect(publications).toMatch(/publicationType === "ANNOUNCEMENT" \? null : channelId/);
    expect(broadcasts).toContain("processQueuedTelegramBroadcasts");
    expect(migration).toContain("publication_id");
    expect(migration).toContain("telegram_broadcasts_publication_unique");
  });
});
