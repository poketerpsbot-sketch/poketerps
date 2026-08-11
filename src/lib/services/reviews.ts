import "server-only";

import { and, asc, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import {
  auditLogs,
  entries,
  ratingCriteria,
  ratings,
  reviews,
  reviewVersions,
  userNotifications,
  userProfileSettings,
  users,
} from "@/lib/db/schema";
import { AppError, conflict, notFound } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { reviewNotificationFor } from "@/lib/reviews/presentation";
import { auditValues, type AuditSource } from "@/lib/services/audit";
import {
  escapeTelegramHtml,
  notifyTelegramAdmins,
  type InlineKeyboardMarkup,
} from "@/lib/services/telegram-client";
import { sendReviewStatusTelegram } from "@/lib/services/notifications";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import type {
  createReviewSchema,
  moderateReviewSchema,
  resubmitReviewSchema,
} from "@/lib/validation/community";

type CreateReview = z.infer<typeof createReviewSchema>;
type ModerateReview = z.infer<typeof moderateReviewSchema>;
type ResubmitReview = z.infer<typeof resubmitReviewSchema>;

export async function listPublishedReviews(entryId: string, limit: number, offset: number) {
  const rows = await getDb()
    .select({
      id: reviews.id,
      content: reviews.content,
      overallRating: reviews.overallRating,
      publishedAt: reviews.publishedAt,
      author: {
        slug: users.publicSlug,
        displayName: reviews.authorDisplayNameSnapshot,
        username: reviews.authorUsernameSnapshot,
        profilePhotoUrl: users.profilePhotoUrl,
        title: users.profileTitle,
      },
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(
      and(eq(reviews.entryId, entryId), eq(reviews.status, "PUBLISHED"), isNull(reviews.deletedAt)),
    )
    .orderBy(desc(reviews.publishedAt), desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => ({ ...row, overallRating: Number(row.overallRating) }));
}

export async function createReview(
  entryId: string,
  input: CreateReview,
  actor: CurrentUser,
  requestId?: string,
) {
  const result = await getDb().transaction(async (tx) => {
    const [entry] = await tx
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(eq(entries.id, entryId), eq(entries.status, "PUBLISHED"), isNull(entries.deletedAt)),
      )
      .limit(1);
    if (!entry) throw notFound("Capture");
    const [existing] = await tx
      .select({ id: reviews.id, status: reviews.status })
      .from(reviews)
      .where(
        and(
          eq(reviews.entryId, entryId),
          eq(reviews.userId, actor.id),
          inArray(reviews.status, [
            "DRAFT",
            "PENDING_REVIEW",
            "CHANGES_REQUESTED",
            "APPROVED",
            "PUBLISHED",
          ]),
          isNull(reviews.deletedAt),
        ),
      )
      .limit(1);
    if (existing)
      throw conflict("Tu as déjà un avis actif pour cette capture.", "REVIEW_ALREADY_EXISTS");

    const [review] = await tx
      .insert(reviews)
      .values({
        entryId,
        userId: actor.id,
        authorDisplayNameSnapshot: actor.displayName,
        authorUsernameSnapshot: actor.username,
        content: input.content,
        overallRating: String(input.overallRating),
        status: "PENDING_REVIEW",
      })
      .returning({ id: reviews.id, status: reviews.status, createdAt: reviews.createdAt });
    if (!review) throw new AppError("REVIEW_CREATE_FAILED", "Envoi de l’avis impossible.", 500);
    const [version] = await tx
      .insert(reviewVersions)
      .values({
        reviewId: review.id,
        versionNumber: 1,
        content: input.content,
        overallRating: String(input.overallRating),
        changedById: actor.id,
        ratingsSnapshot: input.ratings,
      })
      .returning({ id: reviewVersions.id });
    if (!version) {
      throw new AppError(
        "REVIEW_VERSION_FAILED",
        "La version de l’avis n’a pas pu être créée.",
        500,
      );
    }
    await tx.execute(sql`
      insert into review_moderation_events (
        review_id, action, new_status, user_id, review_version_id, metadata
      ) values (
        ${review.id}::uuid, 'SUBMITTED', 'PENDING_REVIEW', ${actor.id}::uuid,
        ${version.id}::uuid, ${JSON.stringify({ overallRating: input.overallRating })}::jsonb
      )
    `);
    if (input.ratings.length > 0) {
      await tx.insert(ratings).values(
        input.ratings.map((rating) => ({
          reviewId: review.id,
          criterionId: rating.criterionId,
          score: String(rating.score),
        })),
      );
    }
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "REVIEW_SUBMITTED",
        entityType: "REVIEW",
        entityId: review.id,
        source: "API",
        requestId,
        after: { entryId, status: review.status, overallRating: input.overallRating },
      }),
    );
    return review;
  });
  await tryRecordUserActivityEvent({
    userId: actor.id,
    eventType: "REVIEW_SUBMIT",
    entityType: "REVIEW",
    entityId: result.id,
    metadata: { phase: "INITIAL", overallRating: input.overallRating },
  });
  return result;
}

const reviewTransitions: Record<string, readonly string[]> = {
  PENDING_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "REJECTED"],
  CHANGES_REQUESTED: ["PENDING_REVIEW", "REJECTED"],
  APPROVED: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["HIDDEN"],
  HIDDEN: ["PUBLISHED"],
};

export async function moderateReview(
  id: string,
  input: ModerateReview,
  actor: CurrentUser,
  requestId?: string,
  source: AuditSource = "WEB_ADMIN",
) {
  const moderationSource = source;
  let result: {
    id: string;
    status: string;
    telegramId: number | null;
    notification: ReturnType<typeof reviewNotificationFor> | null;
    notificationId: string | null;
  };
  try {
    result = await getDb().transaction(async (tx) => {
      const [review] = await tx
        .select({
          id: reviews.id,
          entryId: reviews.entryId,
          userId: reviews.userId,
          status: reviews.status,
          approvedAt: reviews.approvedAt,
          publishedAt: reviews.publishedAt,
          entryName: entries.name,
          telegramId: users.telegramId,
          notifyReviewStatus: userProfileSettings.notifyReviewStatus,
        })
        .from(reviews)
        .innerJoin(entries, eq(reviews.entryId, entries.id))
        .innerJoin(users, eq(reviews.userId, users.id))
        .leftJoin(userProfileSettings, eq(userProfileSettings.userId, users.id))
        .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)))
        .limit(1)
        // Only the review is the moderation concurrency boundary. Locking every
        // joined table makes PostgreSQL reject the nullable LEFT JOIN side.
        .for("update", { of: reviews });
      if (!review) throw notFound("Avis");
      const targetStatus = input.status === "APPROVED" ? "PUBLISHED" : input.status;
      if (!reviewTransitions[review.status]?.includes(targetStatus)) {
        throw conflict(
          "Cet avis a déjà été traité par un autre membre de l’équipe.",
          "ALREADY_MODERATED",
        );
      }
      logger.info("moderation_review_started", {
        action: `review.${input.status.toLowerCase()}`,
        reviewId: id,
        adminId: actor.id,
        previousStatus: review.status,
        targetStatus,
      });
      const now = new Date();
      const set: Partial<typeof reviews.$inferInsert> = {
        status: targetStatus,
        moderatedById: actor.id,
        moderationReason: input.reason ?? null,
        moderatedAt: now,
        updatedAt: now,
      };
      if (targetStatus === "PUBLISHED") set.approvedAt = review.approvedAt ?? now;
      if (targetStatus === "PUBLISHED") {
        set.publishedAt = review.publishedAt ?? now;
        set.hiddenAt = null;
      }
      if (targetStatus === "HIDDEN") set.hiddenAt = now;
      if (targetStatus === "REJECTED") set.rejectedAt = now;
      if (targetStatus === "CHANGES_REQUESTED") set.changesRequestedAt = now;
      const [updated] = await tx
        .update(reviews)
        .set(set)
        .where(and(eq(reviews.id, id), eq(reviews.status, review.status)))
        .returning({ id: reviews.id });
      if (!updated) {
        throw conflict(
          "Cet avis a déjà été traité par un autre membre de l’équipe.",
          "ALREADY_MODERATED",
        );
      }

      const action =
        targetStatus === "PUBLISHED" && review.status === "HIDDEN"
          ? "RESTORED"
          : targetStatus === "PUBLISHED"
            ? "APPROVED"
            : targetStatus === "CHANGES_REQUESTED"
              ? "CHANGES_REQUESTED"
              : targetStatus === "REJECTED"
                ? "REJECTED"
                : targetStatus === "HIDDEN"
                  ? "HIDDEN"
                  : "RESTORED";
      await tx.execute(sql`
      insert into review_moderation_events (
        review_id, action, previous_status, new_status, message, admin_id, metadata
      ) values (
        ${id}::uuid, ${action}::review_moderation_action,
        ${review.status}::review_status, ${targetStatus}::review_status,
        ${input.reason ?? null}, ${actor.id}::uuid,
        ${JSON.stringify({ source: moderationSource })}::jsonb
      )
    `);

      const notification =
        action === "APPROVED" || ["REJECTED", "CHANGES_REQUESTED"].includes(targetStatus)
          ? reviewNotificationFor(
              targetStatus as "PUBLISHED" | "REJECTED" | "CHANGES_REQUESTED",
              review.entryName,
              input.reason,
            )
          : null;
      const [createdNotification] = notification
        ? await tx
            .insert(userNotifications)
            .values({
              userId: review.userId,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              relatedReviewId: id,
              relatedEntryId: review.entryId,
              actionUrl:
                targetStatus === "CHANGES_REQUESTED"
                  ? `/profil/avis/${id}`
                  : notification.actionUrl,
              metadata: { moderationStatus: targetStatus },
            })
            .returning({ id: userNotifications.id })
        : [];
      await tx.insert(auditLogs).values(
        auditValues({
          actorUserId: actor.id,
          actorTelegramIdSnapshot: actor.telegramId,
          action: `REVIEW_${action}`,
          entityType: "REVIEW",
          entityId: id,
          source,
          requestId,
          before: { status: review.status },
          after: { status: targetStatus, reason: input.reason },
        }),
      );
      return {
        id,
        status: targetStatus,
        telegramId: review.notifyReviewStatus === false ? null : review.telegramId,
        notification,
        notificationId: createdNotification?.id ?? null,
      };
    });
  } catch (error) {
    logger.error("moderation_review_failed", {
      action: `review.${input.status.toLowerCase()}`,
      reviewId: id,
      adminId: actor.id,
      error,
    });
    throw error;
  }

  let notificationWarning = false;
  if (result.notification) {
    const sent = await sendReviewStatusTelegram({
      telegramId: result.telegramId,
      text: result.notification.message,
      reviewId: result.id,
    });
    notificationWarning = Boolean(result.telegramId) && !sent;
    if (result.notificationId && result.telegramId) {
      try {
        await getDb()
          .update(userNotifications)
          .set(
            sent
              ? { telegramSentAt: new Date(), telegramError: null }
              : { telegramError: "Envoi Telegram indisponible." },
          )
          .where(eq(userNotifications.id, result.notificationId));
      } catch (error) {
        logger.warn("review_notification_delivery_tracking_failed", {
          reviewId: result.id,
          notificationId: result.notificationId,
          error,
        });
      }
    }
  }
  logger.info("moderation_review_completed", {
    action: `review.${input.status.toLowerCase()}`,
    reviewId: result.id,
    adminId: actor.id,
    status: result.status,
    telegramDelivered: result.telegramId ? !notificationWarning : null,
  });
  return { id: result.id, status: result.status, notificationWarning };
}

export async function getEditableReview(id: string, actor: CurrentUser) {
  const [review] = await getDb()
    .select({
      id: reviews.id,
      entryId: reviews.entryId,
      entryName: entries.name,
      entrySlug: entries.slug,
      content: reviews.content,
      overallRating: reviews.overallRating,
      status: reviews.status,
      moderationReason: reviews.moderationReason,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .innerJoin(entries, eq(reviews.entryId, entries.id))
    .where(and(eq(reviews.id, id), eq(reviews.userId, actor.id), isNull(reviews.deletedAt)))
    .limit(1);
  if (!review) throw notFound("Avis");

  const ratingRows = await getDb()
    .select({
      criterionId: ratings.criterionId,
      key: ratingCriteria.key,
      label: ratingCriteria.label,
      score: ratings.score,
    })
    .from(ratings)
    .innerJoin(ratingCriteria, eq(ratings.criterionId, ratingCriteria.id))
    .where(eq(ratings.reviewId, id))
    .orderBy(asc(ratingCriteria.sortOrder), asc(ratingCriteria.label));

  return {
    ...review,
    overallRating: Number(review.overallRating),
    ratings: ratingRows.map((rating) => ({ ...rating, score: Number(rating.score) })),
    canEdit: review.status === "CHANGES_REQUESTED",
  };
}

export async function resubmitReview(
  id: string,
  input: ResubmitReview,
  actor: CurrentUser,
  requestId?: string,
) {
  const result = await getDb().transaction(async (tx) => {
    const [review] = await tx
      .select({
        id: reviews.id,
        entryId: reviews.entryId,
        userId: reviews.userId,
        status: reviews.status,
        content: reviews.content,
        overallRating: reviews.overallRating,
        moderationReason: reviews.moderationReason,
        entryName: entries.name,
      })
      .from(reviews)
      .innerJoin(entries, eq(reviews.entryId, entries.id))
      .where(and(eq(reviews.id, id), eq(reviews.userId, actor.id), isNull(reviews.deletedAt)))
      .limit(1)
      .for("update");
    if (!review) throw notFound("Avis");
    if (review.status !== "CHANGES_REQUESTED") {
      throw conflict(
        "Cet avis ne peut pas être renvoyé dans son état actuel.",
        "REVIEW_NOT_EDITABLE",
      );
    }

    const currentRatings = await tx
      .select({ criterionId: ratings.criterionId })
      .from(ratings)
      .where(eq(ratings.reviewId, id));
    const currentCriterionIds = new Set(currentRatings.map((rating) => rating.criterionId));
    const submittedCriterionIds = new Set(input.ratings.map((rating) => rating.criterionId));
    if (
      currentCriterionIds.size !== submittedCriterionIds.size ||
      [...currentCriterionIds].some((criterionId) => !submittedCriterionIds.has(criterionId))
    ) {
      throw new AppError(
        "INVALID_REVIEW_RATINGS",
        "Les critères de cet avis ne peuvent pas être remplacés.",
        400,
      );
    }

    const [latest] = await tx
      .select({ value: max(reviewVersions.versionNumber) })
      .from(reviewVersions)
      .where(eq(reviewVersions.reviewId, id));
    const nextVersionNumber = Number(latest?.value ?? 0) + 1;
    const [version] = await tx
      .insert(reviewVersions)
      .values({
        reviewId: id,
        versionNumber: nextVersionNumber,
        content: input.content,
        overallRating: String(input.overallRating),
        changedById: actor.id,
        changeReason: "Modification demandée par l’équipe",
        ratingsSnapshot: input.ratings,
      })
      .returning({ id: reviewVersions.id });
    if (!version) {
      throw new AppError(
        "REVIEW_VERSION_FAILED",
        "La nouvelle version n’a pas pu être créée.",
        500,
      );
    }
    await tx
      .update(reviews)
      .set({
        content: input.content,
        overallRating: String(input.overallRating),
        status: "PENDING_REVIEW",
        moderatedById: null,
        moderationReason: null,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id));
    await tx.delete(ratings).where(eq(ratings.reviewId, id));
    if (input.ratings.length > 0) {
      await tx.insert(ratings).values(
        input.ratings.map((rating) => ({
          reviewId: id,
          criterionId: rating.criterionId,
          score: String(rating.score),
        })),
      );
    }

    await tx.execute(sql`
      update review_moderation_events
      set resolved_at=now(), resolved_by_user_id=${actor.id}::uuid
      where id=(
        select id from review_moderation_events
        where review_id=${id}::uuid and action='CHANGES_REQUESTED' and resolved_at is null
        order by created_at desc limit 1
        for update
      )
    `);
    await tx.execute(sql`
      insert into review_moderation_events (
        review_id, action, previous_status, new_status, message, user_id,
        review_version_id, metadata
      ) values (
        ${id}::uuid, 'RESUBMITTED', 'CHANGES_REQUESTED', 'PENDING_REVIEW',
        'Avis modifié et renvoyé pour validation.', ${actor.id}::uuid,
        ${version.id}::uuid, ${JSON.stringify({ versionNumber: nextVersionNumber })}::jsonb
      )
    `);
    await tx.execute(sql`
      insert into user_notifications (
        user_id, type, title, message, related_review_id, related_entry_id,
        action_url, metadata
      )
      select u.id, 'REVIEW_RESUBMITTED', 'Avis renvoyé pour validation',
        ${`${actor.displayName} a modifié son avis concernant « ${review.entryName} ».`},
        ${id}::uuid, ${review.entryId}::uuid, '/admin/avis',
        ${JSON.stringify({ versionNumber: nextVersionNumber })}::jsonb
      from users u
      where u.role in ('OWNER','ADMIN','MODERATOR')
        and u.is_banned=false and u.suspended_at is null
    `);
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "REVIEW_RESUBMITTED",
        entityType: "REVIEW",
        entityId: id,
        source: "API",
        requestId,
        before: {
          status: review.status,
          content: review.content,
          overallRating: Number(review.overallRating),
        },
        after: {
          status: "PENDING_REVIEW",
          content: input.content,
          overallRating: input.overallRating,
          versionNumber: nextVersionNumber,
        },
      }),
    );
    return { id, entryName: review.entryName, status: "PENDING_REVIEW" as const };
  });

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: "Ouvrir les avis à valider",
          web_app: { url: `${getEnv().NEXT_PUBLIC_APP_URL}/admin/avis` },
        },
      ],
    ],
  };
  await tryRecordUserActivityEvent({
    userId: actor.id,
    eventType: "REVIEW_SUBMIT",
    entityType: "REVIEW",
    entityId: result.id,
    metadata: { phase: "RESUBMISSION", overallRating: input.overallRating },
  });
  try {
    await notifyTelegramAdmins(
      `<b>Avis renvoyé pour validation</b>\n${escapeTelegramHtml(result.entryName)} · ${input.overallRating}/10`,
      keyboard,
    );
  } catch (error) {
    logger.warn("telegram_review_resubmission_notification_failed", { reviewId: id, error });
  }
  return { id: result.id, status: result.status };
}

export async function getPendingReviews(limit = 10) {
  const rows = await getDb()
    .select({
      id: reviews.id,
      entryId: reviews.entryId,
      entryName: entries.name,
      content: reviews.content,
      overallRating: reviews.overallRating,
      authorDisplayName: reviews.authorDisplayNameSnapshot,
      authorUsername: reviews.authorUsernameSnapshot,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(entries, eq(reviews.entryId, entries.id))
    .where(eq(reviews.status, "PENDING_REVIEW"))
    .orderBy(asc(reviews.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, overallRating: Number(row.overallRating) }));
}
