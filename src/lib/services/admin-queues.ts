import "server-only";

import type { CurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/rbac";
import { getDb, getSqlClient } from "@/lib/db";
import { auditLogs, submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppError, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auditValues, type AuditSource } from "@/lib/services/audit";
import { createUserNotification } from "@/lib/services/notifications";

type CountValue = number | string;

type QueueCountRow = {
  pending_entries: CountValue;
  pending_corrections: CountValue;
  pending_reviews: CountValue;
  pending_messages: CountValue;
  pending_reports: CountValue;
  pending_contest_participations: CountValue;
  requested_entry_changes: CountValue;
  requested_review_changes: CountValue;
};

export type AdminQueueCounts = {
  pendingEntries: number;
  pendingCorrections: number;
  pendingReviews: number;
  pendingMessages: number;
  pendingReports: number;
  pendingContestParticipations: number;
  requestedEntryChanges: number;
  requestedReviewChanges: number;
  totalActionable: number;
};

const zeroCounts: AdminQueueCounts = {
  pendingEntries: 0,
  pendingCorrections: 0,
  pendingReviews: 0,
  pendingMessages: 0,
  pendingReports: 0,
  pendingContestParticipations: 0,
  requestedEntryChanges: 0,
  requestedReviewChanges: 0,
  totalActionable: 0,
};

function count(value: CountValue | null | undefined): number {
  return Math.max(0, Number(value ?? 0));
}

/**
 * Returns the exact moderation workload for the current team member. Counts
 * are permission-scoped so a role never learns about a queue it cannot open.
 */
export async function getAdminQueueCounts(actor: CurrentUser): Promise<AdminQueueCounts> {
  const canModerateEntries = hasPermission(actor.role, "entry:moderate");
  const canModerateReviews = hasPermission(actor.role, "review:moderate");
  const canManageMessages = hasPermission(actor.role, "message:manage");
  const canModerateContests = hasPermission(actor.role, "contest:moderate");

  if (!canModerateEntries && !canModerateReviews && !canManageMessages && !canModerateContests) {
    return zeroCounts;
  }

  const [row] = await getSqlClient()<QueueCountRow[]>`
    select
      (select count(*) from entries e
        where ${canModerateEntries}::boolean
          and e.status='PENDING_REVIEW' and e.deleted_at is null)::bigint pending_entries,
      (select count(*) from submissions s
        where ${canModerateEntries}::boolean
          and s.type='CORRECTION' and s.status='PENDING_REVIEW'
          and s.deleted_at is null)::bigint pending_corrections,
      (select count(*) from reviews r
        where ${canModerateReviews}::boolean
          and r.status='PENDING_REVIEW' and r.deleted_at is null)::bigint pending_reviews,
      (select count(*) from admin_messages m
        where ${canManageMessages}::boolean
          and m.type <> 'REPORT' and m.status in ('NEW','READ','IN_PROGRESS'))::bigint pending_messages,
      (select count(*) from admin_messages m
        where ${canManageMessages}::boolean
          and m.type='REPORT' and m.status in ('NEW','READ','IN_PROGRESS'))::bigint pending_reports,
      (select count(*) from contest_participations p
        where ${canModerateContests}::boolean
          and p.status='PENDING_REVIEW')::bigint pending_contest_participations,
      (select count(*) from entries e
        where ${canModerateEntries}::boolean
          and e.status='CHANGES_REQUESTED' and e.deleted_at is null)::bigint requested_entry_changes,
      (select count(*) from reviews r
        where ${canModerateReviews}::boolean
          and r.status='CHANGES_REQUESTED' and r.deleted_at is null)::bigint requested_review_changes
  `;

  const counts = {
    pendingEntries: count(row?.pending_entries),
    pendingCorrections: count(row?.pending_corrections),
    pendingReviews: count(row?.pending_reviews),
    pendingMessages: count(row?.pending_messages),
    pendingReports: count(row?.pending_reports),
    pendingContestParticipations: count(row?.pending_contest_participations),
    requestedEntryChanges: count(row?.requested_entry_changes),
    requestedReviewChanges: count(row?.requested_review_changes),
  };

  return {
    ...counts,
    totalActionable:
      counts.pendingEntries +
      counts.pendingCorrections +
      counts.pendingReviews +
      counts.pendingMessages +
      counts.pendingReports +
      counts.pendingContestParticipations,
  };
}

export type PendingCorrection = {
  id: string;
  title: string;
  summary: string | null;
  submittedAt: string | null;
  entry: { id: string; name: string; slug: string } | null;
  author: { displayName: string; username: string | null };
  changes: Array<{ fieldPath: string; proposedValue: unknown }>;
};

export async function listPendingCorrections(limit = 50): Promise<PendingCorrection[]> {
  const rows = await getSqlClient()<
    Array<{
      id: string;
      title: string;
      message: string | null;
      submitted_at: Date | string | null;
      entry_id: string | null;
      entry_name: string | null;
      entry_slug: string | null;
      display_name: string;
      telegram_username: string | null;
      changes: Array<{ fieldPath: string; proposedValue: unknown }> | null;
    }>
  >`
    select s.id, s.title, s.message, s.submitted_at,
      e.id entry_id, e.name entry_name, e.slug entry_slug,
      u.display_name, u.telegram_username,
      coalesce(
        jsonb_agg(
          jsonb_build_object('fieldPath', sc.field_path, 'proposedValue', sc.new_value)
          order by sc.created_at, sc.id
        ) filter (where sc.id is not null),
        '[]'::jsonb
      ) changes
    from submissions s
    join users u on u.id=s.user_id
    left join entries e on e.id=s.entry_id
    left join submission_changes sc on sc.submission_id=s.id
    where s.type='CORRECTION' and s.status='PENDING_REVIEW' and s.deleted_at is null
    group by s.id, e.id, u.id
    order by s.submitted_at asc nulls last, s.created_at asc
    limit ${Math.min(Math.max(limit, 1), 100)}
  `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.message,
    submittedAt:
      row.submitted_at instanceof Date
        ? row.submitted_at.toISOString()
        : row.submitted_at
          ? String(row.submitted_at)
          : null,
    entry:
      row.entry_id && row.entry_name && row.entry_slug
        ? { id: row.entry_id, name: row.entry_name, slug: row.entry_slug }
        : null,
    author: { displayName: row.display_name, username: row.telegram_username },
    changes: Array.isArray(row.changes) ? row.changes : [],
  }));
}

export async function moderateCorrectionSubmission(
  id: string,
  input: { status: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; reason?: string },
  actor: CurrentUser,
  requestId?: string,
  source: AuditSource = "WEB_ADMIN",
) {
  if (
    (input.status === "CHANGES_REQUESTED" || input.status === "REJECTED") &&
    !input.reason?.trim()
  ) {
    throw new AppError("MODERATION_REASON_REQUIRED", "Un message est obligatoire.", 400);
  }

  const result = await getDb().transaction(async (tx) => {
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1)
      .for("update");
    if (!submission || submission.type !== "CORRECTION" || submission.deletedAt) {
      throw notFound("Proposition de correction");
    }
    if (submission.status !== "PENDING_REVIEW") {
      throw new AppError("INVALID_STATUS_TRANSITION", "Cette proposition a déjà été traitée.", 409);
    }

    const [updated] = await tx
      .update(submissions)
      .set({
        status: input.status,
        reviewedById: actor.id,
        reviewReason: input.reason?.trim() || null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id))
      .returning({
        id: submissions.id,
        userId: submissions.userId,
        entryId: submissions.entryId,
        status: submissions.status,
      });
    if (!updated) throw new Error("Correction moderation update failed");

    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "CORRECTION_MODERATED",
        entityType: "SUBMISSION",
        entityId: id,
        source,
        requestId,
        before: { status: submission.status },
        after: { status: input.status, reason: input.reason?.trim() || null },
      }),
    );
    return updated;
  });

  const titles = {
    APPROVED: "Proposition de correction acceptée",
    CHANGES_REQUESTED: "Précisions demandées sur ta correction",
    REJECTED: "Proposition de correction refusée",
  } as const;
  try {
    await createUserNotification({
      userId: result.userId,
      type: "SYSTEM",
      title: titles[input.status],
      message:
        input.reason?.trim() ||
        "L’équipe a traité ta proposition. Consulte ton profil pour voir son nouvel état.",
      relatedEntryId: result.entryId,
      actionUrl: "/profil",
      metadata: { submissionId: id, status: input.status },
    });
  } catch (error) {
    logger.warn("correction_moderation_notification_failed", { submissionId: id, error });
  }

  return { id: result.id, status: result.status };
}
