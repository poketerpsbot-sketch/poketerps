import { describe, expect, it } from "vitest";

import { assertSettingValueType } from "@/lib/services/admin-settings";
import { assertCanManageUser } from "@/lib/services/admin-users";
import {
  dynamicFieldInputSchema,
  updateAdminUserSchema,
  updateBadgeAssignmentSchema,
} from "@/lib/validation/admin-management";

describe("admin management guards", () => {
  it("prevents administrators from changing their own access or an owner", () => {
    expect(() =>
      assertCanManageUser(
        { id: "admin", role: "ADMIN" },
        { id: "admin", role: "ADMIN", isSystem: false },
        "MEMBER",
      ),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() =>
      assertCanManageUser(
        { id: "owner-2", role: "OWNER" },
        { id: "owner-1", role: "OWNER", isSystem: false },
        "ADMIN",
      ),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("lets an administrator manage lower-privileged members only", () => {
    expect(() =>
      assertCanManageUser(
        { id: "admin", role: "ADMIN" },
        { id: "member", role: "MEMBER", isSystem: false },
        "EDITOR",
      ),
    ).not.toThrow();
    expect(() =>
      assertCanManageUser(
        { id: "admin", role: "ADMIN" },
        { id: "moderator", role: "MODERATOR", isSystem: false },
        "ADMIN",
      ),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("requires an auditable reason for bans and badge revocations", () => {
    expect(updateAdminUserSchema.safeParse({ isBanned: true }).success).toBe(false);
    expect(updateAdminUserSchema.safeParse({ role: "BANNED" }).success).toBe(false);
    expect(
      updateAdminUserSchema.safeParse({ isBanned: true, suspensionReason: "Abus répétés" }).success,
    ).toBe(true);
    expect(updateBadgeAssignmentSchema.safeParse({ isActive: false }).success).toBe(false);
    expect(
      updateBadgeAssignmentSchema.safeParse({ isActive: false, reason: "Attribution erronée" })
        .success,
    ).toBe(true);
  });

  it("validates dynamic field keys and typed settings", () => {
    expect(
      dynamicFieldInputSchema.safeParse({
        categoryId: "00000000-0000-4000-8000-000000000001",
        key: "producer_name",
        label: "Producteur",
        fieldType: "TEXT",
      }).success,
    ).toBe(true);
    expect(() => assertSettingValueType("NUMBER", "18")).toThrowError(
      expect.objectContaining({ code: "INVALID_SETTING_VALUE" }),
    );
    expect(() => assertSettingValueType("URL", "javascript:alert(1)")).toThrowError(
      expect.objectContaining({ code: "INVALID_SETTING_VALUE" }),
    );
    expect(() => assertSettingValueType("URL", "https://example.test")).not.toThrow();
  });
});
