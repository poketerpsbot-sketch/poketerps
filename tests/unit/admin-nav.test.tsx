import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/moderation" }));

import { AdminNav } from "@/components/admin/admin-nav";

describe("role-aware admin navigation", () => {
  it("shows moderators only moderation-scoped destinations", () => {
    const html = renderToStaticMarkup(<AdminNav role="MODERATOR" />);

    expect(html).toContain('href="/admin/moderation"');
    expect(html).toContain('href="/admin/fiches"');
    expect(html).toContain('href="/admin/avis"');
    expect(html).toContain('href="/admin/messages"');
    expect(html).toContain('href="/admin/concours"');
    expect(html).not.toContain('href="/admin"');
    expect(html).not.toContain('href="/admin/categories"');
    expect(html).not.toContain('href="/admin/utilisateurs"');
    expect(html).not.toContain('href="/admin/parametres"');
  });

  it.each(["OWNER", "ADMIN"] as const)("shows the full console to %s", (role) => {
    const html = renderToStaticMarkup(<AdminNav role={role} />);

    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/categories"');
    expect(html).toContain('href="/admin/utilisateurs"');
    expect(html).toContain('href="/admin/parametres"');
  });
});
