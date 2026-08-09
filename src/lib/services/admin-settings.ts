import "server-only";

import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { appSettings, auditLogs } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import type {
  adminSettingsQuerySchema,
  settingValueTypeSchema,
  updateSettingSchema,
} from "@/lib/validation/admin-management";

type AdminSettingsQuery = z.infer<typeof adminSettingsQuerySchema>;
type SettingUpdate = z.infer<typeof updateSettingSchema>;
type SettingValueType = z.infer<typeof settingValueTypeSchema>;

const settingSelection = {
  key: appSettings.key,
  value: appSettings.value,
  valueType: appSettings.valueType,
  description: appSettings.description,
  isPublic: appSettings.isPublic,
  updatedById: appSettings.updatedById,
  createdAt: appSettings.createdAt,
  updatedAt: appSettings.updatedAt,
};

function isSensitiveSetting(key: string): boolean {
  return /(SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|DATABASE_URL)/i.test(key);
}

function settingDto<T extends { key: string; value: unknown }>(setting: T) {
  return isSensitiveSetting(setting.key) ? { ...setting, value: null, isRedacted: true } : setting;
}

export function assertSettingValueType(valueType: SettingValueType, value: unknown): void {
  const valid =
    valueType === "JSON" ||
    (valueType === "STRING" && typeof value === "string") ||
    (valueType === "NUMBER" && typeof value === "number" && Number.isFinite(value)) ||
    (valueType === "BOOLEAN" && typeof value === "boolean") ||
    (valueType === "URL" &&
      typeof value === "string" &&
      (() => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      })());
  if (!valid) {
    throw new AppError(
      "INVALID_SETTING_VALUE",
      `La valeur ne correspond pas au type ${valueType}.`,
      400,
    );
  }
}

export async function listAdminSettings(query: AdminSettingsQuery) {
  const conditions: SQL[] = [];
  if (query.query) {
    const pattern = `%${query.query.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(ilike(appSettings.key, pattern), ilike(appSettings.description, pattern)) as SQL,
    );
  }
  if (query.publicOnly !== undefined) conditions.push(eq(appSettings.isPublic, query.publicOnly));
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select(settingSelection)
      .from(appSettings)
      .where(where)
      .orderBy(asc(appSettings.key))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(appSettings).where(where),
  ]);
  return { settings: rows.map(settingDto), total: Number(totals[0]?.total ?? 0) };
}

export async function updateAdminSetting(
  key: string,
  input: SettingUpdate,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx
      .select(settingSelection)
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1)
      .for("update");
    if (!existing) throw notFound("Paramètre");
    const valueType = input.valueType ?? existing.valueType;
    assertSettingValueType(valueType, input.value);
    const [updated] = await tx
      .update(appSettings)
      .set({
        value: input.value,
        valueType,
        description: input.description,
        isPublic: input.isPublic,
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(appSettings.key, key))
      .returning(settingSelection);
    if (!updated) throw new Error("Setting update failed");
    const redacted = isSensitiveSetting(key);
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "SETTING_UPDATED",
        entityType: "SETTING",
        requestId,
        before: redacted ? { ...existing, value: "[REDACTED]" } : existing,
        after: redacted ? { ...updated, value: "[REDACTED]" } : updated,
        metadata: { key },
      }),
    );
    return settingDto(updated);
  });
}
