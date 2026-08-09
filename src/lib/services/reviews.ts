import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { auditLogs, entries, ratings, reviews, reviewVersions, users } from "@/lib/db/schema";
import { AppError, conflict, notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import type { createReviewSchema, moderateReviewSchema } from "@/lib/validation/community";

type CreateReview = z.infer<typeof createReviewSchema>;
type ModerateReview = z.infer<typeof moderateReviewSchema>;

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
  return getDb().transaction(async (tx) => {
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
    await tx.insert(reviewVersions).values({
      reviewId: review.id,
      versionNumber: 1,
      content: input.content,
      overallRating: String(input.overallRating),
      changedById: actor.id,
    });
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
        requestId,
        after: { entryId, status: review.status, overallRating: input.overallRating },
      }),
    );
    return review;
  });
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
) {
  return getDb().transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, id), isNull(reviews.deletedAt)))
      .limit(1)
      .for("update");
    if (!review) throw notFound("Avis");
    if (!reviewTransitions[review.status]?.includes(input.status)) {
      throw conflict("Transition de statut invalide.", "INVALID_STATUS_TRANSITION");
    }
    const now = new Date();
    const set: Partial<typeof reviews.$inferInsert> = {
      status: input.status,
      moderatedById: actor.id,
      moderationReason: input.reason ?? null,
      updatedAt: now,
    };
    if (input.status === "APPROVED" || input.status === "PUBLISHED")
      set.approvedAt = review.approvedAt ?? now;
    if (input.status === "PUBLISHED") {
      set.publishedAt = review.publishedAt ?? now;
      set.hiddenAt = null;
    }
    if (input.status === "HIDDEN") set.hiddenAt = now;
    await tx.update(reviews).set(set).where(eq(reviews.id, id));
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: `REVIEW_${input.status}`,
        entityType: "REVIEW",
        entityId: id,
        requestId,
        before: { status: review.status },
        after: { status: input.status, reason: input.reason },
      }),
    );
    return { id, status: input.status };
  });
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
