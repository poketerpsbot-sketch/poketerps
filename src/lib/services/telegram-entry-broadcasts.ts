import "server-only";

import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  categories,
  entries,
  entryImages,
  subcategories,
  telegramBroadcastDeliveries,
  telegramBroadcasts,
  users,
  userSessions,
} from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { publicStorageUrl } from "@/lib/services/storage-url";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  sendTelegramPhoto,
  type InlineKeyboardMarkup,
} from "@/lib/services/telegram-client";

const TELEGRAM_BATCH_SIZE = 20;
const TELEGRAM_MAX_ATTEMPTS = 3;
const TELEGRAM_RETRY_DELAYS_MS = [250, 750] as const;

export type EntryPublishedPayload = {
  entryId: string;
  entryUrl: string;
  title: string;
  category: string;
  description: string | null;
  author: string | null;
  imageUrl: string | null;
};

export type AnnouncementBroadcastPayload = {
  publicationId: string;
  text: string;
};

type TelegramBroadcastPayload = EntryPublishedPayload | AnnouncementBroadcastPayload;

type TelegramErrorDetails = {
  errorCode?: number;
  description?: string;
  status?: number;
};

function getTelegramErrorDetails(error: unknown): TelegramErrorDetails {
  if (!(error instanceof AppError) || !error.details || typeof error.details !== "object") {
    return {};
  }
  const details = error.details as Record<string, unknown>;
  return {
    errorCode: typeof details.errorCode === "number" ? details.errorCode : undefined,
    description: typeof details.description === "string" ? details.description : undefined,
    status: typeof details.status === "number" ? details.status : undefined,
  };
}

export function classifyTelegramDeliveryError(error: unknown) {
  const details = getTelegramErrorDetails(error);
  const description = details.description?.toLowerCase() ?? "";
  const blocked =
    details.errorCode === 403 ||
    /blocked|chat not found|user is deactivated|bot was blocked|can't initiate conversation/.test(
      description,
    );
  const retryable =
    !blocked &&
    (details.errorCode === 429 ||
      details.status === 429 ||
      details.status === 502 ||
      details.status === 503 ||
      details.status === 504 ||
      !details.errorCode);
  return { blocked, retryable, details };
}

function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Telegram error";
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function getEntryPublishedPayload(entryId: string): Promise<EntryPublishedPayload> {
  const [entry] = await getDb()
    .select({
      id: entries.id,
      slug: entries.slug,
      name: entries.name,
      shortDescription: entries.shortDescription,
      categoryName: categories.name,
      subcategoryName: subcategories.name,
      contributorName: users.displayName,
      contributorUsername: users.telegramUsername,
    })
    .from(entries)
    .innerJoin(categories, eq(categories.id, entries.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, entries.subcategoryId))
    .innerJoin(users, eq(users.id, entries.originalContributorId))
    .where(
      and(
        eq(entries.id, entryId),
        eq(entries.status, "PUBLISHED"),
        eq(entries.isDemo, false),
        isNull(entries.deletedAt),
      ),
    )
    .limit(1);

  if (!entry)
    throw new AppError("ENTRY_BROADCAST_SOURCE_MISSING", "Fiche publiée introuvable.", 404);

  const [image] = await getDb()
    .select({ bucket: entryImages.storageBucket, path: entryImages.objectPath })
    .from(entryImages)
    .where(
      and(
        eq(entryImages.entryId, entryId),
        eq(entryImages.storageBucket, "entry-images"),
        isNull(entryImages.deletedAt),
      ),
    )
    .orderBy(desc(entryImages.isPrimary), asc(entryImages.sortOrder))
    .limit(1);

  const shortDescription = entry.shortDescription?.trim().replace(/\s+/g, " ") || null;
  const description = shortDescription ? shortDescription.slice(0, 220) : null;
  const author = entry.contributorUsername
    ? `@${entry.contributorUsername.replace(/^@/, "")}`
    : entry.contributorName?.trim() || null;

  return {
    entryId: entry.id,
    entryUrl: `${getEnv().NEXT_PUBLIC_APP_URL}/fiches/${encodeURIComponent(entry.slug)}`,
    title: entry.name,
    category: entry.subcategoryName
      ? `${entry.categoryName} · ${entry.subcategoryName}`
      : entry.categoryName,
    description,
    author,
    imageUrl: image ? publicStorageUrl(image.bucket, image.path) : null,
  };
}

function payloadText(payload: EntryPublishedPayload): string {
  const lines = [
    "<b>🆕 Nouvelle fiche Poketerps</b>",
    "",
    `<b>${escapeTelegramHtml(payload.title)}</b>`,
    escapeTelegramHtml(payload.category),
  ];
  if (payload.description) lines.push("", escapeTelegramHtml(payload.description));
  if (payload.author) lines.push("", `Par ${escapeTelegramHtml(payload.author)}`);
  return lines.join("\n");
}

function payloadKeyboard(payload: EntryPublishedPayload): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: "Voir la fiche complète", web_app: { url: payload.entryUrl } }]],
  };
}

export function formatEntryPublishedTelegramPreview(payload: EntryPublishedPayload): {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
} {
  return { text: payloadText(payload), replyMarkup: payloadKeyboard(payload) };
}

async function sendEntryPreview(
  telegramId: number,
  payload: EntryPublishedPayload,
): Promise<{ messageId: number }> {
  const { text, replyMarkup: keyboard } = formatEntryPublishedTelegramPreview(payload);
  if (payload.imageUrl) {
    try {
      const message = await sendTelegramPhoto(telegramId, payload.imageUrl, text, keyboard);
      return { messageId: message.message_id };
    } catch (error) {
      logger.warn("telegram_entry_broadcast_photo_failed", {
        entryId: payload.entryId,
        error,
      });
    }
  }
  const message = await sendTelegramMessage(telegramId, text, keyboard);
  return { messageId: message.message_id };
}

async function sendBroadcastPreview(
  telegramId: number,
  payload: TelegramBroadcastPayload,
): Promise<{ messageId: number }> {
  if ("entryId" in payload) return sendEntryPreview(telegramId, payload);
  const message = await sendTelegramMessage(telegramId, payload.text);
  return { messageId: message.message_id };
}

export async function prepareEntryPublishedBroadcast(
  broadcastId: string,
  entryId: string,
): Promise<void> {
  const payload = await getEntryPublishedPayload(entryId);
  const db = getDb();

  await db.transaction(async (tx) => {
    const [broadcast] = await tx
      .select({ id: telegramBroadcasts.id })
      .from(telegramBroadcasts)
      .where(and(eq(telegramBroadcasts.id, broadcastId), eq(telegramBroadcasts.status, "QUEUED")))
      .limit(1)
      .for("update");
    if (!broadcast) return;

    const recipients = await tx
      .select({ userId: users.id })
      .from(users)
      .where(
        and(
          eq(users.accountKind, "TELEGRAM"),
          eq(users.isSystem, false),
          isNotNull(users.telegramId),
          gt(users.telegramId, 0),
          eq(users.isBanned, false),
          ne(users.role, "BANNED"),
          isNull(users.suspendedAt),
          sql`exists (
            select 1 from ${userSessions}
            where ${userSessions.userId}=${users.id}
              and ${userSessions.platform}='TELEGRAM_BOT'
          )`,
        ),
      );

    await tx
      .update(telegramBroadcasts)
      .set({ payload, totalRecipients: recipients.length })
      .where(eq(telegramBroadcasts.id, broadcast.id));

    if (recipients.length > 0) {
      await tx
        .insert(telegramBroadcastDeliveries)
        .values(
          recipients.map((recipient) => ({
            broadcastId: broadcast.id,
            userId: recipient.userId,
            status: "QUEUED" as const,
          })),
        )
        .onConflictDoNothing();
    }
  });
}

export async function prepareAnnouncementBroadcast(
  broadcastId: string,
  publicationId: string,
  text: string,
): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [broadcast] = await tx
      .select({ id: telegramBroadcasts.id })
      .from(telegramBroadcasts)
      .where(and(eq(telegramBroadcasts.id, broadcastId), eq(telegramBroadcasts.status, "QUEUED")))
      .limit(1)
      .for("update");
    if (!broadcast) return;

    const recipients = await tx
      .select({ userId: users.id })
      .from(users)
      .where(
        and(
          eq(users.accountKind, "TELEGRAM"),
          eq(users.isSystem, false),
          isNotNull(users.telegramId),
          gt(users.telegramId, 0),
          eq(users.isBanned, false),
          ne(users.role, "BANNED"),
          isNull(users.suspendedAt),
          sql`exists (
            select 1 from ${userSessions}
            where ${userSessions.userId}=${users.id}
              and ${userSessions.platform}='TELEGRAM_BOT'
          )`,
        ),
      );

    const payload: AnnouncementBroadcastPayload = { publicationId, text };
    await tx
      .update(telegramBroadcasts)
      .set({ payload, totalRecipients: recipients.length })
      .where(eq(telegramBroadcasts.id, broadcast.id));
    if (recipients.length > 0) {
      await tx
        .insert(telegramBroadcastDeliveries)
        .values(
          recipients.map((recipient) => ({
            broadcastId: broadcast.id,
            userId: recipient.userId,
            status: "QUEUED" as const,
          })),
        )
        .onConflictDoNothing();
    }
  });
}

async function deliverOne(
  delivery: { id: string; telegramId: number | null; attemptCount: number },
  payload: TelegramBroadcastPayload,
): Promise<"SENT" | "FAILED" | "BLOCKED"> {
  if (!delivery.telegramId) {
    await getDb()
      .update(telegramBroadcastDeliveries)
      .set({
        status: "FAILED",
        errorCode: "MISSING_TELEGRAM_ID",
        errorMessage: "telegram_id absent",
      })
      .where(eq(telegramBroadcastDeliveries.id, delivery.id));
    return "FAILED";
  }

  let attempt = delivery.attemptCount;
  while (attempt < TELEGRAM_MAX_ATTEMPTS) {
    attempt += 1;
    await getDb()
      .update(telegramBroadcastDeliveries)
      .set({ attemptCount: attempt, errorCode: null, errorMessage: null })
      .where(eq(telegramBroadcastDeliveries.id, delivery.id));
    try {
      const message = await sendBroadcastPreview(delivery.telegramId, payload);
      await getDb()
        .update(telegramBroadcastDeliveries)
        .set({
          status: "SENT",
          telegramMessageId: message.messageId,
          sentAt: new Date(),
          nextAttemptAt: null,
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(telegramBroadcastDeliveries.id, delivery.id));
      return "SENT";
    } catch (error) {
      const classification = classifyTelegramDeliveryError(error);
      const finalAttempt = attempt >= TELEGRAM_MAX_ATTEMPTS || !classification.retryable;
      const status = classification.blocked ? "BLOCKED" : finalAttempt ? "FAILED" : "RETRY";
      await getDb()
        .update(telegramBroadcastDeliveries)
        .set({
          status,
          nextAttemptAt: finalAttempt
            ? null
            : new Date(Date.now() + (TELEGRAM_RETRY_DELAYS_MS[attempt - 1] ?? 750)),
          errorCode: classification.blocked ? "TELEGRAM_BLOCKED" : "TELEGRAM_DELIVERY_FAILED",
          errorMessage: errorMessage(error),
        })
        .where(eq(telegramBroadcastDeliveries.id, delivery.id));
      if (finalAttempt) return classification.blocked ? "BLOCKED" : "FAILED";
      await wait(TELEGRAM_RETRY_DELAYS_MS[attempt - 1] ?? 750);
    }
  }
  return "FAILED";
}

export async function processTelegramBroadcast(broadcastId: string): Promise<void> {
  const [claimed] = await getDb()
    .update(telegramBroadcasts)
    .set({ status: "PROCESSING", startedAt: new Date() })
    .where(
      and(
        eq(telegramBroadcasts.id, broadcastId),
        inArray(telegramBroadcasts.status, ["QUEUED", "PARTIAL"]),
      ),
    )
    .returning({ id: telegramBroadcasts.id, payload: telegramBroadcasts.payload });
  if (!claimed) return;

  const payload = claimed.payload as unknown as TelegramBroadcastPayload;
  const deliveries = await getDb()
    .select({
      id: telegramBroadcastDeliveries.id,
      attemptCount: telegramBroadcastDeliveries.attemptCount,
      telegramId: users.telegramId,
    })
    .from(telegramBroadcastDeliveries)
    .innerJoin(users, eq(users.id, telegramBroadcastDeliveries.userId))
    .where(
      and(
        eq(telegramBroadcastDeliveries.broadcastId, broadcastId),
        sql`${telegramBroadcastDeliveries.status} in ('QUEUED','RETRY')`,
        eq(users.isBanned, false),
        ne(users.role, "BANNED"),
        isNull(users.suspendedAt),
      ),
    )
    .orderBy(asc(telegramBroadcastDeliveries.createdAt));

  for (let index = 0; index < deliveries.length; index += TELEGRAM_BATCH_SIZE) {
    const batch = deliveries.slice(index, index + TELEGRAM_BATCH_SIZE);
    await Promise.all(batch.map((delivery) => deliverOne(delivery, payload)));
    if (index + TELEGRAM_BATCH_SIZE < deliveries.length) await wait(1_000);
  }

  const [summary] = await getDb()
    .select({
      sent: sql<number>`count(*) filter (where ${telegramBroadcastDeliveries.status}='SENT')::int`,
      failed: sql<number>`count(*) filter (where ${telegramBroadcastDeliveries.status} in ('FAILED','BLOCKED'))::int`,
      pending: sql<number>`count(*) filter (where ${telegramBroadcastDeliveries.status} in ('QUEUED','RETRY'))::int`,
      retries: sql<number>`coalesce(sum(greatest(${telegramBroadcastDeliveries.attemptCount}-1,0)),0)::int`,
    })
    .from(telegramBroadcastDeliveries)
    .where(eq(telegramBroadcastDeliveries.broadcastId, broadcastId));
  const sent = Number(summary?.sent ?? 0);
  const failed = Number(summary?.failed ?? 0);
  const pending = Number(summary?.pending ?? 0);
  const status =
    pending > 0 ? "PARTIAL" : failed === 0 ? "COMPLETED" : sent > 0 ? "PARTIAL" : "FAILED";
  await getDb()
    .update(telegramBroadcasts)
    .set({
      status,
      sentCount: sent,
      failedCount: failed,
      retryCount: Number(summary?.retries ?? 0),
      completedAt: new Date(),
    })
    .where(
      and(eq(telegramBroadcasts.id, broadcastId), eq(telegramBroadcasts.status, "PROCESSING")),
    );
  logger.info("telegram_entry_broadcast_completed", {
    broadcastId,
    entryId: "entryId" in payload ? payload.entryId : undefined,
    sent,
    failed,
    pending,
  });
}

export async function processQueuedTelegramBroadcasts(limit = 20): Promise<{
  processed: number;
  failed: number;
}> {
  const queued = await getDb()
    .select({ id: telegramBroadcasts.id })
    .from(telegramBroadcasts)
    .where(inArray(telegramBroadcasts.status, ["QUEUED", "PARTIAL"]))
    .orderBy(asc(telegramBroadcasts.createdAt))
    .limit(limit);
  let failed = 0;
  for (const broadcast of queued) {
    try {
      await processTelegramBroadcast(broadcast.id);
    } catch (error) {
      failed += 1;
      logger.error("telegram_broadcast_process_failed", {
        broadcastId: broadcast.id,
        error,
      });
    }
  }
  return { processed: queued.length - failed, failed };
}
