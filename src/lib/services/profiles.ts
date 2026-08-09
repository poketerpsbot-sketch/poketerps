import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import { badges, entries, reviews, submissions, userBadges, users } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { notFound } from "@/lib/errors";

async function getProfileRanks(userId: string) {
  const timezone = getEnv().APP_TIMEZONE;
  const [row] = await getSqlClient()<
    Array<{
      week_rank: number | null;
      month_rank: number | null;
      all_rank: number | null;
      week_captures: number;
      month_captures: number;
      total_captures: number;
    }>
  >`
    with counts as (
      select u.id,
        count(e.id) filter (where e.published_at >= date_trunc('week', now() at time zone ${timezone}) at time zone ${timezone})::int week_captures,
        count(e.id) filter (where e.published_at >= date_trunc('month', now() at time zone ${timezone}) at time zone ${timezone})::int month_captures,
        count(e.id)::int total_captures
      from users u left join entries e on e.original_contributor_id=u.id
        and e.status='PUBLISHED' and e.deleted_at is null
      where u.profile_visibility='PUBLIC' and u.is_banned=false and u.role <> 'BANNED'
      group by u.id
    ), ranked as (
      select *,
        case when week_captures > 0 then dense_rank() over (order by week_captures desc) end::int week_rank,
        case when month_captures > 0 then dense_rank() over (order by month_captures desc) end::int month_rank,
        case when total_captures > 0 then dense_rank() over (order by total_captures desc) end::int all_rank
      from counts
    ) select week_rank, month_rank, all_rank, week_captures, month_captures, total_captures
      from ranked where id=${userId}::uuid
  `;
  return row
    ? {
        weekRank: row.week_rank ? Number(row.week_rank) : null,
        monthRank: row.month_rank ? Number(row.month_rank) : null,
        allRank: row.all_rank ? Number(row.all_rank) : null,
        weekCaptures: Number(row.week_captures),
        monthCaptures: Number(row.month_captures),
        totalCaptures: Number(row.total_captures),
      }
    : {
        weekRank: null,
        monthRank: null,
        allRank: null,
        weekCaptures: 0,
        monthCaptures: 0,
        totalCaptures: 0,
      };
}

export async function getPublicProfile(slug: string) {
  const [profile] = await getDb()
    .select({
      id: users.id,
      slug: users.publicSlug,
      displayName: users.displayName,
      username: users.telegramUsername,
      profilePhotoUrl: users.profilePhotoUrl,
      profileTitle: users.profileTitle,
      bio: users.bio,
      level: users.level,
      experiencePoints: users.experiencePoints,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.publicSlug, slug),
        eq(users.profileVisibility, "PUBLIC"),
        eq(users.isBanned, false),
      ),
    )
    .limit(1);
  if (!profile) throw notFound("Dresseur");

  const [ranks, captureRows, reviewRows, badgeRows] = await Promise.all([
    getProfileRanks(profile.id),
    getDb()
      .select({
        id: entries.id,
        publicNumber: entries.publicNumber,
        slug: entries.slug,
        name: entries.name,
        shortDescription: entries.shortDescription,
        averageRating: entries.averageRating,
        viewCount: entries.viewCount,
        likeCount: entries.likeCount,
        publishedAt: entries.publishedAt,
      })
      .from(entries)
      .where(
        and(
          eq(entries.originalContributorId, profile.id),
          eq(entries.status, "PUBLISHED"),
          isNull(entries.deletedAt),
        ),
      )
      .orderBy(desc(entries.publishedAt))
      .limit(30),
    getDb()
      .select({
        id: reviews.id,
        entryId: reviews.entryId,
        content: reviews.content,
        overallRating: reviews.overallRating,
        publishedAt: reviews.publishedAt,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, profile.id),
          eq(reviews.status, "PUBLISHED"),
          isNull(reviews.deletedAt),
        ),
      )
      .orderBy(desc(reviews.publishedAt))
      .limit(30),
    getDb()
      .select({
        slug: badges.slug,
        name: badges.name,
        description: badges.description,
        icon: badges.icon,
        awardedAt: userBadges.awardedAt,
        expiresAt: userBadges.activeUntil,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(and(eq(userBadges.userId, profile.id), eq(badges.isActive, true))),
  ]);
  const { id, ...publicProfile } = profile;
  void id;
  return { ...publicProfile, ranks, captures: captureRows, reviews: reviewRows, badges: badgeRows };
}

export async function getMyProfile(actor: CurrentUser) {
  const [
    privateProfile,
    entryCounts,
    reviewCounts,
    submissionCounts,
    ranks,
    entryRows,
    reviewRows,
  ] = await Promise.all([
    getDb()
      .select({
        slug: users.publicSlug,
        displayName: users.displayName,
        username: users.telegramUsername,
        profilePhotoUrl: users.profilePhotoUrl,
        profileTitle: users.profileTitle,
        bio: users.bio,
        role: users.role,
        profileVisibility: users.profileVisibility,
        level: users.level,
        experiencePoints: users.experiencePoints,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, actor.id))
      .limit(1),
    getDb()
      .select({ status: entries.status, count: count() })
      .from(entries)
      .where(and(eq(entries.createdById, actor.id), isNull(entries.deletedAt)))
      .groupBy(entries.status),
    getDb()
      .select({ status: reviews.status, count: count() })
      .from(reviews)
      .where(and(eq(reviews.userId, actor.id), isNull(reviews.deletedAt)))
      .groupBy(reviews.status),
    getDb()
      .select({ status: submissions.status, count: count() })
      .from(submissions)
      .where(eq(submissions.userId, actor.id))
      .groupBy(submissions.status),
    getProfileRanks(actor.id),
    getDb()
      .select({
        id: entries.id,
        publicNumber: entries.publicNumber,
        slug: entries.slug,
        name: entries.name,
        shortDescription: entries.shortDescription,
        status: entries.status,
        averageRating: entries.averageRating,
        viewCount: entries.viewCount,
        likeCount: entries.likeCount,
        createdAt: entries.createdAt,
        updatedAt: entries.updatedAt,
        publishedAt: entries.publishedAt,
      })
      .from(entries)
      .where(and(eq(entries.createdById, actor.id), isNull(entries.deletedAt)))
      .orderBy(desc(entries.updatedAt))
      .limit(50),
    getDb()
      .select({
        id: reviews.id,
        entryId: reviews.entryId,
        entryName: entries.name,
        content: reviews.content,
        overallRating: reviews.overallRating,
        status: reviews.status,
        moderationReason: reviews.moderationReason,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        publishedAt: reviews.publishedAt,
      })
      .from(reviews)
      .innerJoin(entries, eq(reviews.entryId, entries.id))
      .where(and(eq(reviews.userId, actor.id), isNull(reviews.deletedAt)))
      .orderBy(desc(reviews.updatedAt))
      .limit(50),
  ]);
  return {
    ...(privateProfile[0] ?? {}),
    ranks,
    entries: entryRows.map((entry) => ({
      ...entry,
      averageRating: Number(entry.averageRating),
    })),
    reviews: reviewRows.map((review) => ({
      ...review,
      overallRating: Number(review.overallRating),
    })),
    counts: {
      entries: Object.fromEntries(entryCounts.map((row) => [row.status, Number(row.count)])),
      reviews: Object.fromEntries(reviewCounts.map((row) => [row.status, Number(row.count)])),
      submissions: Object.fromEntries(
        submissionCounts.map((row) => [row.status, Number(row.count)]),
      ),
    },
  };
}
