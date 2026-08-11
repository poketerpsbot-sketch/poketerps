import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { adminMessageAttachments, adminMessages, auditLogs } from "@/lib/db/schema";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { auditValues, type AuditSource } from "@/lib/services/audit";
import {
  PRIVATE_STORAGE_SIGNED_URL_TTL_SECONDS,
  signedStorageUrls,
} from "@/lib/services/storage-url";
import type {
  createMessageSchema,
  messageQuerySchema,
  updateMessageSchema,
} from "@/lib/validation/community";

type CreateMessage = z.infer<typeof createMessageSchema>;
type MessageQuery = z.infer<typeof messageQuerySchema>;
type UpdateMessage = z.infer<typeof updateMessageSchema>;

export async function createAdminMessage(
  input: CreateMessage,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    for (const path of input.attachmentPaths) {
      if (!path.startsWith(`${actor.id}/`)) throw forbidden("Pièce jointe non autorisée.");
    }
    const [message] = await tx
      .insert(adminMessages)
      .values({
        userId: actor.id,
        type: input.type,
        subject: input.subject,
        content: input.content,
        status: "NEW",
        priority: input.priority,
        relatedEntryId: input.relatedEntryId ?? null,
        relatedReviewId: input.relatedReviewId ?? null,
        relatedPartnerId: input.relatedPartnerId ?? null,
        pageUrl: input.pageUrl ?? null,
        authorDisplayNameSnapshot: actor.displayName,
        authorUsernameSnapshot: actor.username,
        mayContact: input.allowContact,
        metadata: input.metadata,
      })
      .returning({
        id: adminMessages.id,
        status: adminMessages.status,
        createdAt: adminMessages.createdAt,
      });
    if (!message) throw new Error("Message insert failed");
    if (input.attachmentPaths.length > 0) {
      await tx.insert(adminMessageAttachments).values(
        input.attachmentPaths.map((storagePath) => ({
          adminMessageId: message.id,
          storageBucket: "message-attachments",
          objectPath: storagePath,
          mimeType: "application/octet-stream",
          byteSize: 0,
        })),
      );
    }
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "ADMIN_MESSAGE_CREATED",
        entityType: "ADMIN_MESSAGE",
        entityId: message.id,
        source: "API",
        requestId,
        after: { type: input.type, priority: input.priority, status: "NEW" },
      }),
    );
    return message;
  });
}

export async function listAdminMessages(query: MessageQuery) {
  const conditions: SQL[] = [];
  if (query.status) conditions.push(eq(adminMessages.status, query.status));
  if (query.type) conditions.push(eq(adminMessages.type, query.type));
  if (query.query) {
    const pattern = `%${query.query.replace(/[\\%_]/g, "\\$&")}%`;
    conditions.push(
      or(
        ilike(adminMessages.subject, pattern),
        ilike(adminMessages.content, pattern),
        ilike(adminMessages.authorUsernameSnapshot, pattern),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const db = getDb();
  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: adminMessages.id,
        type: adminMessages.type,
        subject: adminMessages.subject,
        content: adminMessages.content,
        status: adminMessages.status,
        priority: adminMessages.priority,
        relatedEntryId: adminMessages.relatedEntryId,
        relatedReviewId: adminMessages.relatedReviewId,
        relatedPartnerId: adminMessages.relatedPartnerId,
        pageUrl: adminMessages.pageUrl,
        authorDisplayName: adminMessages.authorDisplayNameSnapshot,
        authorUsername: adminMessages.authorUsernameSnapshot,
        assignedAdminId: adminMessages.assignedAdminId,
        createdAt: adminMessages.createdAt,
        updatedAt: adminMessages.updatedAt,
        readAt: adminMessages.readAt,
        resolvedAt: adminMessages.resolvedAt,
        archivedAt: adminMessages.archivedAt,
      })
      .from(adminMessages)
      .where(where)
      .orderBy(desc(adminMessages.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(adminMessages).where(where),
  ]);

  if (rows.length === 0) {
    return { messages: [], total: Number(totalRows[0]?.total ?? 0) };
  }

  const messageIds = rows.map((message) => message.id);
  const attachments = await db
    .select({
      id: adminMessageAttachments.id,
      adminMessageId: adminMessageAttachments.adminMessageId,
      objectPath: adminMessageAttachments.objectPath,
      mimeType: adminMessageAttachments.mimeType,
      byteSize: adminMessageAttachments.byteSize,
      createdAt: adminMessageAttachments.createdAt,
    })
    .from(adminMessageAttachments)
    .where(
      and(
        inArray(adminMessageAttachments.adminMessageId, messageIds),
        eq(adminMessageAttachments.storageBucket, "message-attachments"),
      ),
    )
    .orderBy(asc(adminMessageAttachments.createdAt));

  const signedUrls = await signedStorageUrls(
    "message-attachments",
    attachments.map((attachment) => attachment.objectPath),
  );
  const attachmentsByMessage = new Map<
    string,
    Array<{
      id: string;
      mimeType: string;
      byteSize: number;
      createdAt: Date;
      signedUrl: string | null;
      signedUrlExpiresInSeconds: number;
    }>
  >();
  for (const attachment of attachments) {
    const messageAttachments = attachmentsByMessage.get(attachment.adminMessageId) ?? [];
    messageAttachments.push({
      id: attachment.id,
      mimeType: attachment.mimeType,
      byteSize: attachment.byteSize,
      createdAt: attachment.createdAt,
      signedUrl: signedUrls.get(attachment.objectPath) ?? null,
      signedUrlExpiresInSeconds: PRIVATE_STORAGE_SIGNED_URL_TTL_SECONDS,
    });
    attachmentsByMessage.set(attachment.adminMessageId, messageAttachments);
  }

  return {
    messages: rows.map((message) => ({
      ...message,
      attachments: attachmentsByMessage.get(message.id) ?? [],
    })),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export async function updateAdminMessage(
  id: string,
  input: UpdateMessage,
  actor: CurrentUser,
  requestId?: string,
  source: AuditSource = "WEB_ADMIN",
) {
  return getDb().transaction(async (tx) => {
    const [message] = await tx
      .select()
      .from(adminMessages)
      .where(eq(adminMessages.id, id))
      .limit(1)
      .for("update");
    if (!message) throw notFound("Message");
    const desiredAssignee =
      input.assignedAdminId === undefined
        ? input.status === "IN_PROGRESS"
          ? actor.id
          : message.assignedAdminId
        : input.assignedAdminId;
    if (message.assignedAdminId && desiredAssignee && message.assignedAdminId !== desiredAssignee) {
      throw conflict(
        "Ce message est déjà pris en charge par un autre administrateur.",
        "MESSAGE_ALREADY_ASSIGNED",
      );
    }
    const now = new Date();
    const set: Partial<typeof adminMessages.$inferInsert> = { updatedAt: now };
    if (input.status) {
      set.status = input.status;
      if (input.status === "READ" || input.status === "IN_PROGRESS")
        set.readAt = message.readAt ?? now;
      if (input.status === "RESOLVED") set.resolvedAt = now;
      if (input.status === "ARCHIVED") set.archivedAt = now;
    }
    if (input.priority) set.priority = input.priority;
    if (desiredAssignee !== message.assignedAdminId) set.assignedAdminId = desiredAssignee;
    const [updated] = await tx
      .update(adminMessages)
      .set(set)
      .where(eq(adminMessages.id, id))
      .returning({
        id: adminMessages.id,
        status: adminMessages.status,
        priority: adminMessages.priority,
        assignedAdminId: adminMessages.assignedAdminId,
      });
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "ADMIN_MESSAGE_UPDATED",
        entityType: "ADMIN_MESSAGE",
        entityId: id,
        source,
        requestId,
        before: {
          status: message.status,
          priority: message.priority,
          assignedAdminId: message.assignedAdminId,
        },
        after: updated,
      }),
    );
    return updated;
  });
}

export async function getNextAdminMessage(status: "NEW" | "READ" | "IN_PROGRESS" = "NEW") {
  const [message] = await getDb()
    .select()
    .from(adminMessages)
    .where(eq(adminMessages.status, status))
    .orderBy(asc(adminMessages.createdAt))
    .limit(1);
  return message ?? null;
}
