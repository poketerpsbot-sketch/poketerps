import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entriesSource = readFileSync(
  new URL("../../src/lib/services/entries.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/008_entry_management_age_gate_partner_cta.sql",
    import.meta.url,
  ),
  "utf8",
);
const partnersPage = readFileSync(
  new URL("../../src/app/partenaires/page.tsx", import.meta.url),
  "utf8",
);

describe("entry management contracts", () => {
  it("preserves the original contributor and writes a revision for updates", () => {
    const updateBlock = entriesSource.slice(
      entriesSource.indexOf("export async function updateEntry"),
      entriesSource.indexOf("export async function submitEntry"),
    );
    expect(updateBlock).not.toMatch(/set\([^)]*originalContributorId[\s\S]*?\)/);
    expect(updateBlock).toContain("entryRevisions");
    expect(updateBlock).toContain('action: "ENTRY_UPDATED"');
  });

  it("locks moderators to pending moderation and emits both in-app and Telegram notifications", () => {
    expect(entriesSource).toContain('actor.role === "MODERATOR"');
    expect(entriesSource).toContain('entry.status !== "PENDING_REVIEW"');
    expect(entriesSource).toContain("createUserNotification");
    expect(entriesSource).toContain("sendEntryStatusTelegram");
    expect(entriesSource).toContain(
      "actionUrl = changesRequested ? `/profil/fiches/${id}/modifier`",
    );
  });

  it("only lets regular contributors edit drafts or requested changes", () => {
    const updateBlock = entriesSource.slice(
      entriesSource.indexOf("export async function updateEntry"),
      entriesSource.indexOf("export async function submitEntry"),
    );
    expect(updateBlock).toContain('!["DRAFT", "CHANGES_REQUESTED"].includes(existing.status)');
    expect(updateBlock).toContain('hasPermission(actor.role, "entry:update:any")');
  });

  it("adds only future partnership metadata and no payment system", () => {
    expect(migration).toContain("partnership_type");
    expect(migration).toContain("age_gate_confirmed_at");
    expect(partnersPage).toContain("Proposer un partenariat");
    expect(partnersPage).toContain("Bientôt disponible");
    expect(`${migration}\n${partnersPage}`).not.toMatch(/stripe|checkout|payment_intent/i);
  });
});
