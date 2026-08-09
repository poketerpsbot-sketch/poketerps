import { describe, expect, it } from "vitest";

import { assertPermission, hasPermission, isAdminRole } from "@/lib/auth/rbac";

describe("RBAC", () => {
  it("grants every permission to the owner", () => {
    expect(hasPermission("OWNER", "audit:read")).toBe(true);
    expect(hasPermission("OWNER", "partner:manage")).toBe(true);
  });

  it("limits management permissions to administrators", () => {
    expect(hasPermission("ADMIN", "category:manage")).toBe(true);
    expect(hasPermission("ADMIN", "user:manage")).toBe(true);
    expect(hasPermission("ADMIN", "settings:manage")).toBe(true);
    expect(hasPermission("ADMIN", "badge:manage")).toBe(true);
    expect(hasPermission("ADMIN", "publication:manage")).toBe(true);
    expect(hasPermission("MODERATOR", "publication:manage")).toBe(false);
    expect(hasPermission("MODERATOR", "user:manage")).toBe(false);
  });

  it("keeps member and moderator capabilities scoped", () => {
    expect(hasPermission("MEMBER", "entry:create")).toBe(true);
    expect(hasPermission("MEMBER", "entry:moderate")).toBe(false);
    expect(hasPermission("MODERATOR", "review:moderate")).toBe(true);
    expect(hasPermission("MODERATOR", "partner:manage")).toBe(false);
  });

  it("rejects forbidden operations with a 403 error", () => {
    expect(() => assertPermission("BANNED", "message:create")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });

  it("recognizes only staff roles as administrative", () => {
    expect(isAdminRole("OWNER")).toBe(true);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("MODERATOR")).toBe(true);
    expect(isAdminRole("EDITOR")).toBe(false);
  });
});
