import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getOptionalCurrentUser: vi.fn() }));

vi.mock("@/lib/auth/current-user", () => ({
  getOptionalCurrentUser: mocks.getOptionalCurrentUser,
}));
vi.mock("@/components/admin/admin-shell", () => ({
  AdminShell: ({ children, role }: { children: ReactNode; role: string }) => (
    <div data-role={role}>{children}</div>
  ),
}));

import AdminLayout from "@/app/admin/layout";

const user = {
  id: "user-1",
  telegramId: 42,
  username: "nico",
  displayName: "Nico",
  publicSlug: "nico",
  profilePhotoUrl: null,
  role: "MEMBER",
} as const;

beforeEach(() => vi.clearAllMocks());

describe("admin layout role boundary", () => {
  it.each(["OWNER", "ADMIN", "MODERATOR"] as const)("admits the staff role %s", async (role) => {
    mocks.getOptionalCurrentUser.mockResolvedValue({ ...user, role });

    const html = renderToStaticMarkup(await AdminLayout({ children: <p>Contenu équipe</p> }));

    expect(html).toContain(`data-role="${role}"`);
    expect(html).toContain("Contenu équipe");
  });

  it.each([null, "EDITOR", "MEMBER", "BANNED"] as const)(
    "rejects a non-staff session (%s)",
    async (role) => {
      mocks.getOptionalCurrentUser.mockResolvedValue(role ? { ...user, role } : null);

      const html = renderToStaticMarkup(await AdminLayout({ children: <p>Contenu équipe</p> }));

      expect(html).toContain("Zone protégée");
      expect(html).not.toContain("Contenu équipe");
    },
  );
});
