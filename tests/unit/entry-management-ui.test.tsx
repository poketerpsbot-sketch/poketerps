import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AdminEntryManagementActions } from "@/components/admin/admin-entry-management-actions";
import { EntryCard } from "@/components/entries/entry-card";

describe("entry management controls", () => {
  it("renders published-entry management actions only in the admin component", () => {
    const admin = renderToStaticMarkup(
      <AdminEntryManagementActions
        entryId="11111111-1111-4111-8111-111111111111"
        slug="blue-zushi"
        name="Blue Zushi"
        status="PUBLISHED"
      />,
    );
    expect(admin).toContain("Modifier");
    expect(admin).toContain("Masquer");
    expect(admin).toContain("Archiver");
    expect(admin).toContain("Supprimer");

    const publicCard = renderToStaticMarkup(
      <EntryCard entry={{ id: "entry", slug: "blue-zushi", name: "Blue Zushi" }} />,
    );
    expect(publicCard).not.toContain("Modifier");
    expect(publicCard).not.toContain("Archiver");
    expect(publicCard).not.toContain("Supprimer");
  });

  it("shows restore and publish actions only for matching statuses", () => {
    const archived = renderToStaticMarkup(
      <AdminEntryManagementActions
        entryId="11111111-1111-4111-8111-111111111111"
        slug="archive"
        name="Archive"
        status="ARCHIVED"
      />,
    );
    const approved = renderToStaticMarkup(
      <AdminEntryManagementActions
        entryId="22222222-2222-4222-8222-222222222222"
        slug="approved"
        name="Approved"
        status="APPROVED"
      />,
    );
    expect(archived).toContain("Restaurer");
    expect(approved).toContain("Publier");
  });
});
