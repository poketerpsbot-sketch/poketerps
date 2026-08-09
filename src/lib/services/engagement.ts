import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getDb, getSqlClient } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import { notFound } from "@/lib/errors";

async function assertPublishedEntry(entryId: string): Promise<void> {
  const [entry] = await getDb()
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.status, "PUBLISHED"), isNull(entries.deletedAt)))
    .limit(1);
  if (!entry) throw notFound("Capture");
}

export async function recordEntryView(
  entryId: string,
  viewer: { userId?: string | null; anonymousSessionHash?: string | null },
  dedupHours: number,
) {
  await assertPublishedEntry(entryId);
  const [result] = await getSqlClient()<Array<{ counted: boolean; view_count: number }>>`
    select counted, view_count
    from record_entry_view(
      ${entryId}::uuid,
      ${viewer.userId ?? null}::uuid,
      ${viewer.anonymousSessionHash ?? null}::text,
      ${dedupHours}::integer
    )
  `;
  return {
    counted: Boolean(result?.counted),
    viewCount: Number(result?.view_count ?? 0),
  };
}

export async function setEntryLike(entryId: string, userId: string, desired: boolean) {
  await assertPublishedEntry(entryId);
  const [result] = await getSqlClient()<Array<{ liked: boolean; like_count: number }>>`
    select liked, like_count
    from toggle_entry_like(${entryId}::uuid, ${userId}::uuid, ${desired}::boolean)
  `;
  return {
    liked: Boolean(result?.liked),
    likeCount: Number(result?.like_count ?? 0),
  };
}
