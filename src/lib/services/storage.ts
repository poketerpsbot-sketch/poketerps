import "server-only";

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { and, eq, isNull, max } from "drizzle-orm";
import sharp from "sharp";

import type { CurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import {
  adminMessageAttachments,
  adminMessages,
  contests,
  entries,
  entryImages,
} from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { publicStorageUrl } from "@/lib/services/storage-url";

export type StorageBucket =
  | "entry-images"
  | "partner-images"
  | "app-assets"
  | "message-attachments"
  | "contest-images"
  | "contest-results";

export type StoredBucket = StorageBucket | "entry-drafts";

export type EntryImagePromotion = {
  paths: string[];
  rollbackPaths: string[];
};

const bucketLimits: Record<StorageBucket, number> = {
  "entry-images": 8 * 1024 * 1024,
  "partner-images": 5 * 1024 * 1024,
  "app-assets": 10 * 1024 * 1024,
  "message-attachments": 5 * 1024 * 1024,
  "contest-images": 8 * 1024 * 1024,
  "contest-results": 8 * 1024 * 1024,
};

function storageClient() {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function storageDestinationForUpload(bucket: StorageBucket): StoredBucket {
  return bucket === "entry-images" ? "entry-drafts" : bucket;
}

export function isPublicStorageBucket(bucket: StoredBucket): boolean {
  return (
    bucket === "entry-images" ||
    bucket === "partner-images" ||
    bucket === "app-assets" ||
    bucket === "contest-images"
  );
}

function assertEntryImageWritable(
  entry: { createdById: string; status: string },
  actor: CurrentUser,
): void {
  const editableStatus =
    ["DRAFT", "CHANGES_REQUESTED", "APPROVED"].includes(entry.status) ||
    (hasPermission(actor.role, "entry:update:any") &&
      ["PUBLISHED", "HIDDEN", "ARCHIVED"].includes(entry.status));
  const canEdit = entry.createdById === actor.id || hasPermission(actor.role, "entry:update:any");
  if (!editableStatus || !canEdit) {
    throw new AppError(
      "ENTRY_IMAGE_LOCKED",
      "Les images de cette capture ne sont plus modifiables.",
      409,
    );
  }
}

function detectedMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes
      .slice(0, 8)
      .every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 12)).startsWith("ftypavif")) {
    return "image/avif";
  }
  return null;
}

function authorizeBucket(bucket: StorageBucket, actor: CurrentUser): void {
  if (bucket === "entry-images" && hasPermission(actor.role, "storage:upload:entry")) return;
  if (bucket === "message-attachments" && hasPermission(actor.role, "storage:upload:message")) {
    return;
  }
  if (
    (bucket === "partner-images" || bucket === "app-assets") &&
    hasPermission(actor.role, "storage:upload:partner")
  ) {
    return;
  }
  if (
    (bucket === "contest-images" || bucket === "contest-results") &&
    hasPermission(actor.role, "contest:manage")
  ) {
    return;
  }
  throw forbidden();
}

async function assertRelatedResource(
  bucket: StorageBucket,
  relatedId: string | null | undefined,
  actor: CurrentUser,
): Promise<void> {
  if ((bucket === "entry-images" || bucket === "message-attachments") && !relatedId) {
    throw new AppError("RELATED_ID_REQUIRED", "La ressource associée est requise.", 400);
  }
  if (bucket === "entry-images" && relatedId) {
    const [entry] = await getDb()
      .select({ id: entries.id, createdById: entries.createdById, status: entries.status })
      .from(entries)
      .where(and(eq(entries.id, relatedId), isNull(entries.deletedAt)))
      .limit(1);
    if (!entry) throw notFound("Capture");
    assertEntryImageWritable(entry, actor);
  }
  if (bucket === "message-attachments" && relatedId) {
    const [message] = await getDb()
      .select({ id: adminMessages.id, userId: adminMessages.userId })
      .from(adminMessages)
      .where(eq(adminMessages.id, relatedId))
      .limit(1);
    if (!message) throw notFound("Message");
    if (message.userId !== actor.id && !hasPermission(actor.role, "message:manage")) {
      throw forbidden();
    }
  }
  if ((bucket === "contest-images" || bucket === "contest-results") && relatedId) {
    const [contest] = await getDb()
      .select({ id: contests.id })
      .from(contests)
      .where(and(eq(contests.id, relatedId), isNull(contests.deletedAt)))
      .limit(1);
    if (!contest) throw notFound("Concours");
  }
}

export async function uploadImage(
  file: File,
  bucket: StorageBucket,
  actor: CurrentUser,
  relatedId?: string | null,
) {
  authorizeBucket(bucket, actor);
  await assertRelatedResource(bucket, relatedId, actor);
  if (file.size <= 0 || file.size > bucketLimits[bucket]) {
    throw new AppError("INVALID_FILE_SIZE", "Taille de fichier non autorisée.", 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectedMime(bytes);
  if (!mime || mime !== file.type) {
    throw new AppError("INVALID_FILE_TYPE", "Type d’image non autorisé.", 400);
  }

  let processed: {
    data: Buffer;
    info: { width: number; height: number; size: number };
  };
  try {
    processed = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2_048, height: 2_048, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    throw new AppError("INVALID_IMAGE", "L’image ne peut pas être traitée.", 400, {
      cause: error,
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  const path = `${actor.id}/${date}/${randomUUID()}.webp`;
  const storedBucket = storageDestinationForUpload(bucket);
  const supabase = storageClient();
  const { error } = await supabase.storage.from(storedBucket).upload(path, processed.data, {
    contentType: "image/webp",
    cacheControl:
      bucket === "message-attachments" || bucket === "contest-results" ? "3600" : "31536000",
    upsert: false,
  });
  if (error) {
    throw new AppError("STORAGE_UPLOAD_FAILED", "Envoi du fichier impossible.", 502, {
      cause: error,
    });
  }

  try {
    if (bucket === "entry-images" && relatedId) {
      await getDb().transaction(async (tx) => {
        const [entry] = await tx
          .select({ createdById: entries.createdById, status: entries.status })
          .from(entries)
          .where(and(eq(entries.id, relatedId), isNull(entries.deletedAt)))
          .limit(1)
          .for("update");
        if (!entry) throw notFound("Capture");
        assertEntryImageWritable(entry, actor);
        const [sort] = await tx
          .select({ value: max(entryImages.sortOrder) })
          .from(entryImages)
          .where(and(eq(entryImages.entryId, relatedId), isNull(entryImages.deletedAt)));
        const [primary] = await tx
          .select({ id: entryImages.id })
          .from(entryImages)
          .where(
            and(
              eq(entryImages.entryId, relatedId),
              eq(entryImages.isPrimary, true),
              isNull(entryImages.deletedAt),
            ),
          )
          .limit(1);
        const isPrimary = !primary;
        await tx.insert(entryImages).values({
          entryId: relatedId,
          storageBucket: storedBucket,
          objectPath: path,
          kind: isPrimary ? "PRIMARY" : "GALLERY",
          mimeType: "image/webp",
          byteSize: processed.info.size,
          width: processed.info.width,
          height: processed.info.height,
          sortOrder: Number(sort?.value ?? -1) + 1,
          isPrimary,
          createdById: actor.id,
        });
      });
    }
    if (bucket === "message-attachments" && relatedId) {
      await getDb().insert(adminMessageAttachments).values({
        adminMessageId: relatedId,
        storageBucket: bucket,
        objectPath: path,
        mimeType: "image/webp",
        byteSize: processed.info.size,
      });
    }
  } catch (associationError) {
    const { error: removeError } = await supabase.storage.from(storedBucket).remove([path]);
    if (removeError) {
      logger.error("storage_orphan_cleanup_failed", {
        bucket: storedBucket,
        path,
        error: removeError,
      });
    }
    throw new AppError("STORAGE_ASSOCIATION_FAILED", "Association du fichier impossible.", 500, {
      cause: associationError,
      expose: false,
    });
  }

  return {
    bucket: storedBucket,
    path,
    publicUrl: isPublicStorageBucket(storedBucket) ? publicStorageUrl(storedBucket, path) : null,
    mimeType: "image/webp",
    byteSize: processed.info.size,
    width: processed.info.width,
    height: processed.info.height,
  };
}

export async function prepareEntryImagePromotion(
  images: Array<{ objectPath: string; mimeType?: string }>,
): Promise<EntryImagePromotion> {
  if (images.length === 0) return { paths: [], rollbackPaths: [] };
  const supabase = storageClient();
  const paths: string[] = [];
  const rollbackPaths: string[] = [];

  try {
    for (const image of images) {
      const { data, error: downloadError } = await supabase.storage
        .from("entry-drafts")
        .download(image.objectPath);
      if (downloadError || !data) {
        throw new AppError(
          "STORAGE_PROMOTION_FAILED",
          "Une image privée n’a pas pu être préparée pour publication.",
          502,
          { cause: downloadError },
        );
      }
      const payload = Buffer.from(await data.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from("entry-images")
        .upload(image.objectPath, payload, {
          contentType: image.mimeType ?? "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) {
        // A previous attempt may have copied the exact object before losing its
        // response or before its SQL transaction rolled back. Reuse only a
        // byte-identical orphan, and still remove it if this SQL attempt fails.
        let destinationMatches = false;
        try {
          const { data: existing } = await supabase.storage
            .from("entry-images")
            .download(image.objectPath);
          if (existing) {
            const existingPayload = Buffer.from(await existing.arrayBuffer());
            destinationMatches = payload.equals(existingPayload);
          }
        } catch {
          // Preserve the original upload error and its stable application code.
        }
        if (destinationMatches) {
          paths.push(image.objectPath);
          rollbackPaths.push(image.objectPath);
          continue;
        }
        throw new AppError("STORAGE_PROMOTION_FAILED", "Une image n’a pas pu être publiée.", 502, {
          cause: uploadError,
        });
      }
      paths.push(image.objectPath);
      rollbackPaths.push(image.objectPath);
    }
    return { paths, rollbackPaths };
  } catch (error) {
    if (rollbackPaths.length > 0) {
      try {
        const { error: cleanupError } = await supabase.storage
          .from("entry-images")
          .remove(rollbackPaths);
        if (cleanupError) {
          logger.error("storage_promotion_rollback_failed", {
            paths: rollbackPaths,
            error: cleanupError,
          });
        }
      } catch (cleanupError) {
        logger.error("storage_promotion_rollback_failed", {
          paths: rollbackPaths,
          error: cleanupError,
        });
      }
    }
    throw error;
  }
}

export async function rollbackEntryImagePromotion(promotion: EntryImagePromotion): Promise<void> {
  if (promotion.rollbackPaths.length === 0) return;
  try {
    const { error } = await storageClient()
      .storage.from("entry-images")
      .remove(promotion.rollbackPaths);
    if (error) {
      logger.error("storage_promotion_rollback_failed", {
        paths: promotion.rollbackPaths,
        error,
      });
    }
  } catch (error) {
    logger.error("storage_promotion_rollback_failed", {
      paths: promotion.rollbackPaths,
      error,
    });
  }
}

export async function finalizeEntryImagePromotion(promotion: EntryImagePromotion): Promise<void> {
  if (promotion.paths.length === 0) return;
  try {
    const { error } = await storageClient().storage.from("entry-drafts").remove(promotion.paths);
    if (error) logger.error("storage_draft_cleanup_failed", { paths: promotion.paths, error });
  } catch (error) {
    // Publication is already committed at this point. A private duplicate is
    // preferable to deleting the public object referenced by the database.
    logger.error("storage_draft_cleanup_failed", { paths: promotion.paths, error });
  }
}

export async function removeEntryStorageObjects(
  objects: Array<{ bucket: string; path: string }>,
): Promise<void> {
  const allowedBuckets = new Set<StoredBucket>(["entry-images", "entry-drafts"]);
  const grouped = new Map<StoredBucket, string[]>();
  for (const object of objects) {
    if (!allowedBuckets.has(object.bucket as StoredBucket) || !object.path) continue;
    const bucket = object.bucket as StoredBucket;
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), object.path]);
  }
  for (const [bucket, paths] of grouped) {
    const { error } = await storageClient()
      .storage.from(bucket)
      .remove([...new Set(paths)]);
    if (error) throw new Error(`Storage cleanup failed for ${bucket}: ${error.message}`);
  }
}
