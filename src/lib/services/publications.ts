import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import { entries, entryImages, partners, telegramPublications } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { AppError, conflict, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { recordAudit } from "@/lib/services/audit";
import { publicStorageUrl } from "@/lib/services/storage-url";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "@/lib/services/telegram-client";
import type { createPublicationSchema } from "@/lib/validation/admin";

type CreatePublication = z.infer<typeof createPublicationSchema>;
type PublicationPayload = { text: string; imageUrl?: string };

export async function listPublications(query: { limit: number; offset: number; status?: string }) {
  const status = query.status ?? null;
  const rows = await getSqlClient()<
    Array<{
      id: string;
      type: string;
      entry_id: string | null;
      partner_id: string | null;
      status: string;
      channel_id: string | null;
      telegram_message_id: string | number | null;
      preview_payload: Record<string, unknown>;
      final_payload: Record<string, unknown> | null;
      scheduled_at: Date | null;
      published_at: Date | null;
      last_error: string | null;
      attempt_count: number;
      created_by_id: string | null;
      created_at: Date;
      updated_at: Date;
      entry_name: string | null;
      partner_name: string | null;
      total_count: number;
    }>
  >`
    select p.*, e.name as entry_name, partner.name as partner_name,
      count(*) over()::int as total_count
    from telegram_publications p
    left join entries e on e.id = p.entry_id
    left join partners partner on partner.id = p.partner_id
    where (${status}::text is null or p.status::text = ${status})
    order by p.created_at desc
    limit ${query.limit} offset ${query.offset}
  `;
  return {
    publications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      entryId: row.entry_id,
      entryName: row.entry_name,
      partnerId: row.partner_id,
      partnerName: row.partner_name,
      status: row.status,
      channelId: row.channel_id,
      telegramMessageId: row.telegram_message_id === null ? null : Number(row.telegram_message_id),
      previewPayload: row.preview_payload,
      finalPayload: row.final_payload,
      scheduledAt: row.scheduled_at,
      publishedAt: row.published_at,
      lastError: row.last_error,
      attemptCount: row.attempt_count,
      createdById: row.created_by_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    total: Number(rows[0]?.total_count ?? 0),
  };
}

export async function createPublication(
  input: CreatePublication,
  actor: CurrentUser,
  requestId?: string,
) {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const [publication] = await getDb()
    .insert(telegramPublications)
    .values({
      type: input.type,
      entryId: input.entryId ?? null,
      partnerId: input.partnerId ?? null,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt,
      previewPayload: input.text ? { text: input.text } : {},
      createdById: actor.id,
    })
    .returning({ id: telegramPublications.id, status: telegramPublications.status });
  if (!publication) throw new AppError("PUBLICATION_CREATE_FAILED", "Création impossible.", 500);
  await recordAudit({
    actorUserId: actor.id,
    actorTelegramIdSnapshot: actor.telegramId,
    action: "TELEGRAM_PUBLICATION_CREATED",
    entityType: "TELEGRAM_PUBLICATION",
    entityId: publication.id,
    requestId,
    after: { type: input.type, status: publication.status },
  });
  return publication;
}

async function buildPayload(id: string): Promise<PublicationPayload> {
  const [publication] = await getDb()
    .select()
    .from(telegramPublications)
    .where(eq(telegramPublications.id, id))
    .limit(1);
  if (!publication) throw notFound("Publication");

  if (publication.type === "ANNOUNCEMENT") {
    const text = publication.previewPayload.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new AppError("INVALID_PUBLICATION", "Texte de publication manquant.", 400);
    }
    return { text: escapeTelegramHtml(text.trim()) };
  }
  if (publication.type === "ENTRY" && publication.entryId) {
    const [entry] = await getDb()
      .select({
        slug: entries.slug,
        name: entries.name,
        shortDescription: entries.shortDescription,
      })
      .from(entries)
      .where(and(eq(entries.id, publication.entryId), isNull(entries.deletedAt)))
      .limit(1);
    if (!entry) throw notFound("Capture");
    const [image] = await getDb()
      .select({ bucket: entryImages.storageBucket, path: entryImages.objectPath })
      .from(entryImages)
      .where(and(eq(entryImages.entryId, publication.entryId), isNull(entryImages.deletedAt)))
      .orderBy(entryImages.sortOrder)
      .limit(1);
    const description = entry.shortDescription
      ? `\n\n${escapeTelegramHtml(entry.shortDescription.slice(0, 500))}`
      : "";
    return {
      text: `<b>${escapeTelegramHtml(entry.name)}</b>${description}\n\n<a href="${getEnv().NEXT_PUBLIC_APP_URL}/fiches/${encodeURIComponent(entry.slug)}">Voir la fiche</a>`,
      imageUrl: image ? (publicStorageUrl(image.bucket, image.path) ?? undefined) : undefined,
    };
  }
  if (publication.type === "PARTNER" && publication.partnerId) {
    const [partner] = await getDb()
      .select({
        slug: partners.slug,
        name: partners.name,
        description: partners.description,
        logoBucket: partners.logoBucket,
        logoPath: partners.logoPath,
        coverBucket: partners.coverBucket,
        coverPath: partners.coverPath,
      })
      .from(partners)
      .where(and(eq(partners.id, publication.partnerId), isNull(partners.deletedAt)))
      .limit(1);
    if (!partner) throw notFound("Partenaire");
    const description = partner.description
      ? `\n\n${escapeTelegramHtml(partner.description.slice(0, 500))}`
      : "";
    const imageUrl = partner.coverPath
      ? publicStorageUrl(partner.coverBucket ?? "partner-images", partner.coverPath)
      : publicStorageUrl(partner.logoBucket ?? "partner-images", partner.logoPath);
    return {
      text: `<b>${escapeTelegramHtml(partner.name)}</b>${description}\n\n<a href="${getEnv().NEXT_PUBLIC_APP_URL}/partenaires/${encodeURIComponent(partner.slug)}">Découvrir</a>`,
      imageUrl: imageUrl ?? undefined,
    };
  }
  throw new AppError("INVALID_PUBLICATION", "Cible de publication manquante.", 400);
}

async function deliverPublication(channelId: string | number, payload: PublicationPayload) {
  if (payload.imageUrl && payload.text.length <= 1_024) {
    try {
      return await sendTelegramPhoto(channelId, payload.imageUrl, payload.text);
    } catch (error) {
      logger.warn("telegram_publication_photo_failed", { channelId, error });
    }
  }
  return sendTelegramMessage(channelId, payload.text);
}

export async function previewPublication(id: string, actor: CurrentUser, requestId?: string) {
  const payload = await buildPayload(id);
  const [updated] = await getDb()
    .update(telegramPublications)
    .set({ status: "PREVIEWED", previewPayload: payload, updatedAt: new Date() })
    .where(
      and(
        eq(telegramPublications.id, id),
        inArray(telegramPublications.status, ["DRAFT", "PREVIEWED", "FAILED"]),
      ),
    )
    .returning({ id: telegramPublications.id, status: telegramPublications.status });
  if (!updated)
    throw conflict(
      "Cette publication ne peut plus être prévisualisée.",
      "INVALID_PUBLICATION_STATUS",
    );
  if (actor.telegramId !== null) await deliverPublication(actor.telegramId, payload);
  await recordAudit({
    actorUserId: actor.id,
    actorTelegramIdSnapshot: actor.telegramId,
    action: "TELEGRAM_PUBLICATION_PREVIEWED",
    entityType: "TELEGRAM_PUBLICATION",
    entityId: id,
    requestId,
  });
  return { ...updated, preview: payload };
}

export async function publishPublication(id: string, actor: CurrentUser, requestId?: string) {
  const channelId = getEnv().TELEGRAM_CHANNEL_ID;
  if (!channelId)
    throw new AppError("TELEGRAM_CHANNEL_NOT_CONFIGURED", "Canal Telegram non configuré.", 503);
  const payload = await buildPayload(id);
  const [claimed] = await getDb()
    .update(telegramPublications)
    .set({
      status: "PUBLISHING",
      channelId,
      previewPayload: payload,
      lastError: null,
      attemptCount: sql`${telegramPublications.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(telegramPublications.id, id),
        inArray(telegramPublications.status, ["DRAFT", "PREVIEWED", "SCHEDULED", "FAILED"]),
      ),
    )
    .returning({ id: telegramPublications.id });
  if (!claimed) throw conflict("Publication déjà traitée.", "PUBLICATION_ALREADY_CLAIMED");

  try {
    const message = await deliverPublication(channelId, payload);
    await getDb()
      .update(telegramPublications)
      .set({
        status: "PUBLISHED",
        telegramMessageId: message.message_id,
        finalPayload: payload,
        publishedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(and(eq(telegramPublications.id, id), eq(telegramPublications.status, "PUBLISHING")));
  } catch (error) {
    await getDb()
      .update(telegramPublications)
      .set({
        status: "FAILED",
        lastError: (error instanceof Error ? error.message : "Telegram error").slice(0, 2_000),
        updatedAt: new Date(),
      })
      .where(and(eq(telegramPublications.id, id), eq(telegramPublications.status, "PUBLISHING")));
    throw error;
  }
  await recordAudit({
    actorUserId: actor.id,
    actorTelegramIdSnapshot: actor.telegramId,
    action: "TELEGRAM_PUBLICATION_PUBLISHED",
    entityType: "TELEGRAM_PUBLICATION",
    entityId: id,
    requestId,
    after: { channelId },
  });
  return { id, status: "PUBLISHED" as const };
}

export async function cancelPublication(id: string, actor: CurrentUser, requestId?: string) {
  const [updated] = await getDb()
    .update(telegramPublications)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(
      and(
        eq(telegramPublications.id, id),
        inArray(telegramPublications.status, ["DRAFT", "PREVIEWED", "SCHEDULED", "FAILED"]),
      ),
    )
    .returning({ id: telegramPublications.id, status: telegramPublications.status });
  if (!updated)
    throw conflict("Cette publication ne peut pas être annulée.", "INVALID_PUBLICATION_STATUS");
  await recordAudit({
    actorUserId: actor.id,
    actorTelegramIdSnapshot: actor.telegramId,
    action: "TELEGRAM_PUBLICATION_CANCELLED",
    entityType: "TELEGRAM_PUBLICATION",
    entityId: id,
    requestId,
  });
  return updated;
}
