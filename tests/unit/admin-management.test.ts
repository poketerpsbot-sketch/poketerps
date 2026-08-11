import { describe, expect, it } from "vitest";

import { assertSettingValueType, updateAdminSetting } from "@/lib/services/admin-settings";
import { assertCanManageUser } from "@/lib/services/admin-users";
import {
  adminUserInternalNoteSchema,
  adminUserTelegramMessageSchema,
  dynamicFieldInputSchema,
  micronPresetInputSchema,
  subcategoryInputSchema,
  teamActivityQuerySchema,
  updateUserTeamPermissionSchema,
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
      updateAdminUserSchema.safeParse({
        role: "BANNED",
        isBanned: false,
        suspensionReason: "Décision contradictoire",
        restorationReason: "Réactivation demandée",
      }).success,
    ).toBe(false);
    expect(
      updateAdminUserSchema.safeParse({ isBanned: true, suspensionReason: "Abus répétés" }).success,
    ).toBe(true);
    expect(updateAdminUserSchema.safeParse({ isBanned: false }).success).toBe(false);
    expect(
      updateAdminUserSchema.safeParse({
        isBanned: false,
        restorationReason: "Sanction terminée et vérifiée",
      }).success,
    ).toBe(true);
    expect(updateAdminUserSchema.safeParse({ role: "EDITOR" }).success).toBe(false);
    expect(
      updateAdminUserSchema.safeParse({
        role: "EDITOR",
        roleChangeReason: "Renfort éditorial validé",
      }).success,
    ).toBe(true);
    expect(updateBadgeAssignmentSchema.safeParse({ isActive: false }).success).toBe(false);
    expect(
      updateBadgeAssignmentSchema.safeParse({ isActive: false, reason: "Attribution erronée" })
        .success,
    ).toBe(true);
  });

  it("preserves omitted, temporary and permanent suspension endings", () => {
    const omitted = updateAdminUserSchema.parse({
      isBanned: true,
      suspensionReason: "Violation répétée du règlement",
    });
    const permanent = updateAdminUserSchema.parse({
      isBanned: true,
      suspensionReason: "Fraude confirmée et durable",
      suspensionUntil: null,
    });
    const temporary = updateAdminUserSchema.parse({
      isBanned: true,
      suspensionReason: "Pause de modération",
      suspensionUntil: "2099-12-31T23:59:59.000Z",
    });

    expect("suspensionUntil" in omitted).toBe(false);
    expect(permanent.suspensionUntil).toBeNull();
    expect(temporary.suspensionUntil).toBe("2099-12-31T23:59:59.000Z");
  });

  it("validates staff notes, Telegram messages and the seven-day activity window", () => {
    expect(adminUserInternalNoteSchema.safeParse({ content: "À surveiller" }).success).toBe(true);
    expect(adminUserInternalNoteSchema.safeParse({ content: "" }).success).toBe(false);
    expect(
      adminUserTelegramMessageSchema.safeParse({ text: "Bonjour depuis PokéTerps" }).success,
    ).toBe(true);
    expect(adminUserTelegramMessageSchema.safeParse({ text: "x".repeat(4_097) }).success).toBe(
      false,
    );
    expect(teamActivityQuerySchema.parse({})).toMatchObject({ days: 7, scope: "all" });
    expect(
      updateUserTeamPermissionSchema.safeParse({
        permissionCode: "VIEW_TEAM_AUDIT_LOG",
        isGranted: true,
      }).success,
    ).toBe(true);
    expect(
      updateUserTeamPermissionSchema.safeParse({
        permissionCode: "user:manage",
        isGranted: true,
      }).success,
    ).toBe(false);
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

  it("reserves sensitive Telegram and bot settings to the owner", async () => {
    const admin = {
      id: "00000000-0000-4000-8000-000000000010",
      telegramId: 10,
      username: "admin",
      displayName: "Admin",
      publicSlug: "admin",
      profilePhotoUrl: null,
      role: "ADMIN" as const,
    };
    await expect(
      updateAdminSetting("TELEGRAM_BOT_TOKEN", { value: "secret", valueType: "STRING" }, admin),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("validates typed micron presets and deduplicates taxonomy contexts", () => {
    expect(
      micronPresetInputSchema.safeParse({
        slug: "pressing-bag-90-um",
        context: "PRESSING_BAG",
        mode: "SINGLE",
        label: "90 Âµm",
      }).success,
    ).toBe(false);
    expect(
      micronPresetInputSchema.safeParse({
        slug: "pressing-bag-90-um",
        context: "PRESSING_BAG",
        mode: "SINGLE",
        label: "90 Âµm",
        singleValue: 90,
      }).success,
    ).toBe(true);
    const subcategory = subcategoryInputSchema.parse({
      categoryId: "00000000-0000-4000-8000-000000000001",
      name: "Hash Rosin",
      micronRequirement: "OPTIONAL",
      allowedMicronContexts: ["PRESSING_BAG", "PRESSING_BAG"],
    });
    expect(subcategory.allowedMicronContexts).toEqual(["PRESSING_BAG"]);
  });
});
