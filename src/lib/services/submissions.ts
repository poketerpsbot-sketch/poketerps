import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { auditLogs, entries, submissionChanges, submissions } from "@/lib/db/schema";
import { notFound } from "@/lib/errors";
import { auditValues } from "@/lib/services/audit";
import type { correctionSchema } from "@/lib/validation/entries";

type CorrectionInput = z.infer<typeof correctionSchema>;

export async function createCorrection(
  input: CorrectionInput,
  actor: CurrentUser,
  requestId?: string,
) {
  return getDb().transaction(async (tx) => {
    const [entry] = await tx
      .select({ id: entries.id, status: entries.status, name: entries.name })
      .from(entries)
      .where(
        and(
          eq(entries.id, input.entryId),
          eq(entries.status, "PUBLISHED"),
          isNull(entries.deletedAt),
        ),
      )
      .limit(1);
    if (!entry) throw notFound("Capture");
    const [submission] = await tx
      .insert(submissions)
      .values({
        type: "CORRECTION",
        entryId: input.entryId,
        userId: actor.id,
        title: `Correction · ${entry.name}`,
        message: input.summary,
        status: "PENDING_REVIEW",
        payload: { summary: input.summary },
        submittedAt: new Date(),
      })
      .returning({
        id: submissions.id,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
      });
    if (!submission) throw new Error("Correction insert failed");
    await tx.insert(submissionChanges).values(
      input.changes.map((change) => ({
        submissionId: submission.id,
        fieldPath: change.fieldPath,
        newValue: change.proposedValue,
      })),
    );
    await tx.insert(auditLogs).values(
      auditValues({
        actorUserId: actor.id,
        actorTelegramIdSnapshot: actor.telegramId,
        action: "CORRECTION_SUBMITTED",
        entityType: "SUBMISSION",
        entityId: submission.id,
        source: "API",
        requestId,
        after: {
          entryId: input.entryId,
          status: "PENDING_REVIEW",
          changeCount: input.changes.length,
        },
      }),
    );
    return submission;
  });
}

export async function listSubmissions(actor: CurrentUser, limit: number, offset: number) {
  return getDb()
    .select({
      id: submissions.id,
      type: submissions.type,
      entryId: submissions.entryId,
      entryName: entries.name,
      entrySlug: entries.slug,
      status: submissions.status,
      payload: submissions.payload,
      moderationReason: submissions.reviewReason,
      createdAt: submissions.createdAt,
      submittedAt: submissions.submittedAt,
      resolvedAt: submissions.reviewedAt,
    })
    .from(submissions)
    .leftJoin(entries, eq(submissions.entryId, entries.id))
    .where(and(eq(submissions.userId, actor.id), isNull(submissions.deletedAt)))
    .orderBy(desc(submissions.createdAt))
    .limit(limit)
    .offset(offset);
}
