import "server-only";

import { and, count, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

import type { CurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import {
  badges,
  categories,
  entries,
  entryLikes,
  entryViewEvents,
  favorites,
  reviews,
  submissions,
  userBadges,
  users,
} from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { listFavorites } from "@/lib/services/favorites";
import { getExperienceOverview } from "@/lib/services/experience";
import { countUnreadNotifications } from "@/lib/services/notifications";
import { publicStorageUrl } from "@/lib/services/storage-url";
import { experienceProgress } from "@/lib/xp";

async function loadProfileSection<T>(section: string, loader: () => Promise<T>, fallback: T) {
  try {
    return await loader();
  } catch (error) {
    logger.warn("profile_section_unavailable", { area: "profile", section, error });
    return fallback;
  }
}

const myEntrySelection = {
  id: entries.id,
  publicNumber: entries.publicNumber,
  slug: entries.slug,
  name: entries.name,
  shortDescription: entries.shortDescription,
  status: entries.status,
  averageRating: entries.averageRating,
  reviewCount: entries.reviewCount,
  viewCount: entries.viewCount,
  likeCount: entries.likeCount,
  favoriteCount: entries.favoriteCount,
  category: { id: categories.id, slug: categories.slug, name: categories.name },
  createdAt: entries.createdAt,
  updatedAt: entries.updatedAt,
  publishedAt: entries.publishedAt,
  primaryImagePath: sql<string | null>`(
    select image.object_path from entry_images image
    where image.entry_id=${entries.id} and image.deleted_at is null
    order by image.is_primary desc, image.sort_order asc limit 1
  )`,
};

type MyEntryRow = {
  id: string;
  publicNumber: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  averageRating: string | number;
  reviewCount: number;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  category: { id: string; slug: string; name: string };
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  primaryImagePath: string | null;
};

function myEntryDto(row: MyEntryRow) {
  const { primaryImagePath, ...entry } = row;
  return {
    ...entry,
    averageRating: Number(entry.averageRating),
    reviewCount: Number(entry.reviewCount),
    viewCount: Number(entry.viewCount),
    likeCount: Number(entry.likeCount),
    favoriteCount: Number(entry.favoriteCount),
    primaryImageUrl: publicStorageUrl("entry-images", primaryImagePath),
  };
}

function statusCounts(rows: Array<{ status: string; count: number | string }>) {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}

function totalCounts(values: Record<string, number>) {
  return Object.values(values).reduce((total, value) => total + value, 0);
}

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
        and e.status='PUBLISHED' and e.deleted_at is null and e.is_demo=false
      where u.account_kind='TELEGRAM' and u.is_system=false
        and u.profile_visibility='PUBLIC' and u.is_banned=false and u.role <> 'BANNED'
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
    loadProfileSection("public-rankings", () => getProfileRanks(profile.id), {
      weekRank: null,
      monthRank: null,
      allRank: null,
      weekCaptures: 0,
      monthCaptures: 0,
      totalCaptures: 0,
    }),
    loadProfileSection(
      "public-captures",
      async () =>
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
              eq(entries.isDemo, false),
              isNull(entries.deletedAt),
            ),
          )
          .orderBy(desc(entries.publishedAt))
          .limit(30),
      [],
    ),
    loadProfileSection(
      "public-reviews",
      async () =>
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
      [],
    ),
    loadProfileSection(
      "public-badges",
      async () =>
        getDb()
          .select({
            slug: badges.slug,
            name: badges.name,
            description: badges.description,
            icon: badges.icon,
            imageUrl: badges.imageUrl,
            category: badges.category,
            rarity: badges.rarity,
            xpReward: badges.xpReward,
            awardedAt: userBadges.awardedAt,
            activeUntil: userBadges.activeUntil,
          })
          .from(userBadges)
          .innerJoin(badges, eq(userBadges.badgeId, badges.id))
          .where(
            and(
              eq(userBadges.userId, profile.id),
              eq(userBadges.isActive, true),
              eq(badges.isActive, true),
              or(isNull(userBadges.activeFrom), lte(userBadges.activeFrom, new Date())),
              or(isNull(userBadges.activeUntil), gt(userBadges.activeUntil, new Date())),
            ),
          ),
      [],
    ),
  ]);
  const { id, ...publicProfile } = profile;
  void id;
  return {
    ...publicProfile,
    ranks,
    captures: captureRows,
    reviews: reviewRows,
    badges: badgeRows,
    experience: { progress: experienceProgress(profile.experiencePoints) },
  };
}

export async function getMyProfile(actor: CurrentUser) {
  const [
    privateProfile,
    entryCounts,
    reviewCounts,
    submissionCounts,
    ranks,
    entryRows,
    publishedEntryRows,
    publishedCountRows,
    reviewRows,
    submissionRows,
    favoriteRows,
    favoriteCountRows,
    likedRows,
    likedCountRows,
    recentViewRows,
    recentViewCountRows,
    badgeRows,
    unreadNotificationCount,
    experience,
  ] = await Promise.all([
    loadProfileSection(
      "identity",
      async () =>
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
      [],
    ),
    loadProfileSection(
      "entry-counts",
      async () =>
        getDb()
          .select({ status: entries.status, count: count() })
          .from(entries)
          .where(and(eq(entries.createdById, actor.id), isNull(entries.deletedAt)))
          .groupBy(entries.status),
      [],
    ),
    loadProfileSection(
      "review-counts",
      async () =>
        getDb()
          .select({ status: reviews.status, count: count() })
          .from(reviews)
          .where(and(eq(reviews.userId, actor.id), isNull(reviews.deletedAt)))
          .groupBy(reviews.status),
      [],
    ),
    loadProfileSection(
      "submission-counts",
      async () =>
        getDb()
          .select({ status: submissions.status, count: count() })
          .from(submissions)
          .where(and(eq(submissions.userId, actor.id), isNull(submissions.deletedAt)))
          .groupBy(submissions.status),
      [],
    ),
    loadProfileSection("rankings", () => getProfileRanks(actor.id), {
      weekRank: null,
      monthRank: null,
      allRank: null,
      weekCaptures: 0,
      monthCaptures: 0,
      totalCaptures: 0,
    }),
    loadProfileSection(
      "entries",
      async () =>
        getDb()
          .select(myEntrySelection)
          .from(entries)
          .innerJoin(categories, eq(entries.categoryId, categories.id))
          .where(and(eq(entries.createdById, actor.id), isNull(entries.deletedAt)))
          .orderBy(desc(entries.updatedAt))
          .limit(50),
      [],
    ),
    loadProfileSection(
      "published-entries",
      async () =>
        getDb()
          .select(myEntrySelection)
          .from(entries)
          .innerJoin(categories, eq(entries.categoryId, categories.id))
          .where(
            and(
              eq(entries.originalContributorId, actor.id),
              eq(entries.status, "PUBLISHED"),
              eq(entries.isDemo, false),
              isNull(entries.deletedAt),
            ),
          )
          .orderBy(desc(entries.publishedAt))
          .limit(24),
      [],
    ),
    loadProfileSection(
      "published-entry-count",
      async () =>
        getDb()
          .select({ count: count() })
          .from(entries)
          .where(
            and(
              eq(entries.originalContributorId, actor.id),
              eq(entries.status, "PUBLISHED"),
              eq(entries.isDemo, false),
              isNull(entries.deletedAt),
            ),
          ),
      [],
    ),
    loadProfileSection(
      "reviews",
      async () =>
        getDb()
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
            publishedAt: reviews.publishedAt,
          })
          .from(reviews)
          .innerJoin(entries, eq(reviews.entryId, entries.id))
          .where(and(eq(reviews.userId, actor.id), isNull(reviews.deletedAt)))
          .orderBy(desc(reviews.updatedAt))
          .limit(50),
      [],
    ),
    loadProfileSection(
      "submissions",
      async () =>
        getDb()
          .select({
            id: submissions.id,
            type: submissions.type,
            status: submissions.status,
            title: submissions.title,
            entryId: submissions.entryId,
            entryName: entries.name,
            entrySlug: entries.slug,
            moderationReason: submissions.reviewReason,
            createdAt: submissions.createdAt,
            updatedAt: submissions.updatedAt,
            submittedAt: submissions.submittedAt,
            resolvedAt: submissions.reviewedAt,
          })
          .from(submissions)
          .leftJoin(entries, eq(submissions.entryId, entries.id))
          .where(and(eq(submissions.userId, actor.id), isNull(submissions.deletedAt)))
          .orderBy(desc(submissions.updatedAt))
          .limit(30),
      [],
    ),
    loadProfileSection("favorites", () => listFavorites(actor.id, 24, 0), []),
    loadProfileSection(
      "favorite-count",
      async () =>
        getDb()
          .select({ count: count() })
          .from(favorites)
          .innerJoin(entries, eq(favorites.entryId, entries.id))
          .where(
            and(
              eq(favorites.userId, actor.id),
              eq(entries.status, "PUBLISHED"),
              isNull(entries.deletedAt),
            ),
          ),
      [],
    ),
    loadProfileSection(
      "liked-entries",
      async () =>
        getDb()
          .select({
            ...myEntrySelection,
            likedAt: entryLikes.createdAt,
          })
          .from(entryLikes)
          .innerJoin(entries, eq(entryLikes.entryId, entries.id))
          .innerJoin(categories, eq(entries.categoryId, categories.id))
          .where(
            and(
              eq(entryLikes.userId, actor.id),
              eq(entries.status, "PUBLISHED"),
              isNull(entries.deletedAt),
            ),
          )
          .orderBy(desc(entryLikes.createdAt))
          .limit(24),
      [],
    ),
    loadProfileSection(
      "liked-entry-count",
      async () =>
        getDb()
          .select({ count: count() })
          .from(entryLikes)
          .innerJoin(entries, eq(entryLikes.entryId, entries.id))
          .where(
            and(
              eq(entryLikes.userId, actor.id),
              eq(entries.status, "PUBLISHED"),
              isNull(entries.deletedAt),
            ),
          ),
      [],
    ),
    loadProfileSection(
      "recent-views",
      async () => {
        const rows = await getSqlClient()<
          Array<{
            id: string;
            public_number: number;
            slug: string;
            name: string;
            short_description: string | null;
            status: string;
            average_rating: string | number;
            review_count: number;
            view_count: number;
            like_count: number;
            favorite_count: number;
            category_id: string;
            category_slug: string;
            category_name: string;
            created_at: Date;
            updated_at: Date;
            published_at: Date | null;
            primary_image_path: string | null;
            viewed_at: Date;
          }>
        >`
          select recent.* from (
        select distinct on (e.id)
          e.id, e.public_number, e.slug, e.name, e.short_description,
          e.status::text, e.average_rating, e.review_count, e.view_count,
          e.like_count, e.favorite_count, e.created_at, e.updated_at, e.published_at,
          c.id category_id, c.slug category_slug, c.name category_name,
          (
            select image.object_path from entry_images image
            where image.entry_id=e.id and image.deleted_at is null
            order by image.is_primary desc, image.sort_order asc limit 1
          ) primary_image_path,
          event.created_at viewed_at
        from entry_view_events event
        join entries e on e.id=event.entry_id
        join categories c on c.id=e.category_id
        where event.user_id=${actor.id}::uuid
          and e.status='PUBLISHED' and e.deleted_at is null
        order by e.id, event.created_at desc
      ) recent
      order by recent.viewed_at desc
          limit 24
        `;
        return Array.from(rows);
      },
      [],
    ),
    loadProfileSection(
      "recent-view-count",
      async () =>
        getDb()
          .select({ count: sql<number>`count(distinct ${entryViewEvents.entryId})` })
          .from(entryViewEvents)
          .innerJoin(entries, eq(entryViewEvents.entryId, entries.id))
          .where(
            and(
              eq(entryViewEvents.userId, actor.id),
              eq(entries.status, "PUBLISHED"),
              isNull(entries.deletedAt),
            ),
          ),
      [],
    ),
    loadProfileSection(
      "badges",
      async () =>
        getDb()
          .select({
            id: badges.id,
            slug: badges.slug,
            name: badges.name,
            description: badges.description,
            icon: badges.icon,
            imageUrl: badges.imageUrl,
            category: badges.category,
            rarity: badges.rarity,
            xpReward: badges.xpReward,
            kind: badges.kind,
            awardedAt: userBadges.awardedAt,
            activeUntil: userBadges.activeUntil,
          })
          .from(userBadges)
          .innerJoin(badges, eq(userBadges.badgeId, badges.id))
          .where(
            and(
              eq(userBadges.userId, actor.id),
              eq(userBadges.isActive, true),
              eq(badges.isActive, true),
              or(isNull(userBadges.activeFrom), lte(userBadges.activeFrom, new Date())),
              or(isNull(userBadges.activeUntil), gt(userBadges.activeUntil, new Date())),
            ),
          )
          .orderBy(desc(userBadges.awardedAt)),
      [],
    ),
    loadProfileSection("notifications", () => countUnreadNotifications(actor.id), 0),
    loadProfileSection("experience", () => getExperienceOverview(actor.id), {
      progress: experienceProgress(0),
      events: [],
      rules: [],
      levels: [],
    }),
  ]);

  const entryCountMap = statusCounts(entryCounts);
  const reviewCountMap = statusCounts(reviewCounts);
  const submissionCountMap = statusCounts(submissionCounts);
  const recentViews = recentViewRows.map((row) =>
    myEntryDto({
      id: row.id,
      publicNumber: row.public_number,
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description,
      status: row.status,
      averageRating: row.average_rating,
      reviewCount: Number(row.review_count),
      viewCount: Number(row.view_count),
      likeCount: Number(row.like_count),
      favoriteCount: Number(row.favorite_count),
      category: { id: row.category_id, slug: row.category_slug, name: row.category_name },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      primaryImagePath: row.primary_image_path,
    }),
  );

  const identity = privateProfile[0] ?? {
    slug: actor.publicSlug,
    displayName: actor.displayName,
    username: actor.username,
    profilePhotoUrl: actor.profilePhotoUrl,
    profileTitle: null,
    bio: null,
    role: actor.role,
    profileVisibility: "PUBLIC",
    level: 1,
    experiencePoints: 0,
    createdAt: null,
  };

  return {
    ...identity,
    captureCount: Number(publishedCountRows[0]?.count ?? 0),
    telegramIdentity: {
      displayName: identity.displayName,
      username: identity.username,
      profilePhotoUrl: identity.profilePhotoUrl,
    },
    ranks,
    entries: entryRows.map((entry) => myEntryDto(entry)),
    publishedEntries: publishedEntryRows.map((entry) => myEntryDto(entry)),
    reviews: reviewRows.map((review) => ({
      ...review,
      overallRating: Number(review.overallRating),
    })),
    submissions: submissionRows,
    favorites: favoriteRows,
    likedEntries: likedRows.map(({ likedAt, ...entry }) => ({
      ...myEntryDto(entry),
      likedAt,
    })),
    recentViews: recentViews.map((entry, index) => ({
      ...entry,
      viewedAt: recentViewRows[index]?.viewed_at,
    })),
    badges: badgeRows,
    stats: {
      entriesAdded: totalCounts(entryCountMap),
      entriesPublished: Number(publishedCountRows[0]?.count ?? 0),
      entriesPending: Number(entryCountMap.PENDING_REVIEW ?? 0),
      reviewsTotal: totalCounts(reviewCountMap),
      reviewsPublished: Number(reviewCountMap.PUBLISHED ?? 0),
      reviewsPending: Number(reviewCountMap.PENDING_REVIEW ?? 0),
      submissionsTotal: totalCounts(submissionCountMap),
      submissionsPending: Number(submissionCountMap.PENDING_REVIEW ?? 0),
      favorites: Number(favoriteCountRows[0]?.count ?? 0),
      likes: Number(likedCountRows[0]?.count ?? 0),
      recentlyViewed: Number(recentViewCountRows[0]?.count ?? 0),
      badges: badgeRows.length,
    },
    counts: {
      entries: entryCountMap,
      reviews: reviewCountMap,
      submissions: submissionCountMap,
    },
    unreadNotificationCount,
    experience,
  };
}
