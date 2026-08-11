import { describe, expect, it } from "vitest";

import { assertPermission, canAccessWebAdmin, hasPermission, isAdminRole } from "@/lib/auth/rbac";

describe("RBAC", () => {
  it("grants every permission to the owner", () => {
    expect(hasPermission("OWNER", "audit:read")).toBe(true);
    expect(hasPermission("OWNER", "partner:manage")).toBe(true);
    expect(hasPermission("OWNER", "bot:manage")).toBe(true);
    expect(hasPermission("OWNER", "entry:delete:permanent")).toBe(true);
  });

  it("limits management permissions to administrators", () => {
    expect(hasPermission("ADMIN", "category:manage")).toBe(true);
    expect(hasPermission("ADMIN", "user:manage")).toBe(true);
    expect(hasPermission("ADMIN", "settings:manage")).toBe(true);
    expect(hasPermission("ADMIN", "badge:manage")).toBe(true);
    expect(hasPermission("ADMIN", "publication:manage")).toBe(true);
    expect(hasPermission("ADMIN", "contest:manage")).toBe(true);
    expect(hasPermission("ADMIN", "contest:moderate")).toBe(true);
    expect(hasPermission("ADMIN", "entry:update:any")).toBe(true);
    expect(hasPermission("ADMIN", "bot:manage")).toBe(false);
    expect(hasPermission("ADMIN", "entry:delete:permanent")).toBe(false);
    expect(hasPermission("MODERATOR", "publication:manage")).toBe(false);
    expect(hasPermission("MODERATOR", "user:manage")).toBe(false);
    expect(hasPermission("MODERATOR", "contest:manage")).toBe(false);
  });

  it("keeps member and moderator capabilities scoped", () => {
    expect(hasPermission("MEMBER", "entry:create")).toBe(true);
    expect(hasPermission("MEMBER", "entry:moderate")).toBe(false);
    expect(hasPermission("MODERATOR", "review:moderate")).toBe(true);
    expect(hasPermission("MODERATOR", "entry:moderate")).toBe(true);
    expect(hasPermission("MODERATOR", "contest:moderate")).toBe(true);
    expect(hasPermission("MODERATOR", "partner:manage")).toBe(false);
    expect(hasPermission("MODERATOR", "settings:manage")).toBe(false);
    expect(hasPermission("MODERATOR", "entry:update:any")).toBe(false);
  });

  it("separates team activity from the sensitive team audit log", () => {
    expect(hasPermission("OWNER", "VIEW_TEAM_AUDIT_LOG")).toBe(true);
    expect(hasPermission("ADMIN", "VIEW_ADMIN_ACTIVITY")).toBe(false);
    expect(hasPermission("ADMIN", "VIEW_MODERATOR_ACTIVITY")).toBe(true);
    expect(hasPermission("ADMIN", "VIEW_TEAM_AUDIT_LOG")).toBe(false);
    expect(hasPermission("MODERATOR", "VIEW_MODERATOR_ACTIVITY")).toBe(false);
    expect(hasPermission("MODERATOR", "VIEW_ADMIN_ACTIVITY")).toBe(false);
    expect(hasPermission("MODERATOR", "VIEW_TEAM_AUDIT_LOG")).toBe(false);
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

  it("shows the full web console only to owners and administrators", () => {
    expect(canAccessWebAdmin("OWNER")).toBe(true);
    expect(canAccessWebAdmin("ADMIN")).toBe(true);
    expect(canAccessWebAdmin("MODERATOR")).toBe(false);
    expect(canAccessWebAdmin("EDITOR")).toBe(false);
    expect(canAccessWebAdmin("MEMBER")).toBe(false);
  });
});
