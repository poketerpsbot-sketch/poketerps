import "server-only";

import { asc, eq } from "drizzle-orm";

import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { getDb, getSqlClient } from "@/lib/db";
import { homeSections, levelDefinitions, users } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { searchCatalogue } from "@/lib/services/catalogue";
import { listPublicContests } from "@/lib/services/contests";
import { listPartners } from "@/lib/services/partners";
import { getTrainerRankings } from "@/lib/services/rankings";
import { effectiveExperienceProgress } from "@/lib/xp";

type HomeSectionKey =
  | "viewer"
  | "latest"
  | "trending"
  | "trainers"
  | "partners"
  | "configuration"
  | "contests"
  | "since-last-visit";

async function loadHomeSection<T>(
  section: HomeSectionKey,
  loader: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; available: boolean }> {
  try {
    return { value: await loader(), available: true };
  } catch (error) {
    logger.warn("home_section_unavailable", { area: "home", section, error });
    return { value: fallback, available: false };
  }
}

async function listHomeSections() {
  return getDb()
    .select({
      key: homeSections.key,
      title: homeSections.title,
      sortOrder: homeSections.sortOrder,
      configuration: homeSections.config,
    })
    .from(homeSections)
    .where(eq(homeSections.isEnabled, true))
    .orderBy(asc(homeSections.sortOrder));
}

type SinceLastVisitRow = {
  previous_end: string | null;
  gap_seconds: number | string;
  new_entries: number | string;
  new_contests: number | string;
  approved_reviews: number | string;
  xp_gained: number | string;
};

async function getSinceLastVisit(userId: string) {
  try {
    const [row] = await getSqlClient()<SinceLastVisitRow[]>`
      with recent_sessions as (
        select started_at,last_activity_at,
          row_number() over(order by started_at desc) position
        from user_sessions where user_id=${userId}::uuid
        order by started_at desc limit 2
      ), visit as (
        select previous.last_activity_at previous_end,
          extract(epoch from (current.started_at-previous.last_activity_at))::bigint gap_seconds
        from recent_sessions current join recent_sessions previous
          on current.position=1 and previous.position=2
      )
      select visit.previous_end,visit.gap_seconds,
        (select count(*) from entries e where e.status='PUBLISHED' and e.deleted_at is null
          and e.is_demo=false and e.published_at>visit.previous_end)::bigint new_entries,
        (select count(*) from contests c where c.deleted_at is null
          and c.status::text in ('ACTIVE','OPEN','SCHEDULED')
          and greatest(c.created_at,c.updated_at)>visit.previous_end)::bigint new_contests,
        (select count(*) from reviews r where r.user_id=${userId}::uuid
          and r.status='PUBLISHED' and r.published_at>visit.previous_end)::bigint approved_reviews,
        (select coalesce(sum(x.points),0) from user_experience_events x
          where x.user_id=${userId}::uuid and x.created_at>visit.previous_end)::bigint xp_gained
      from visit
    `;
    if (!row || Number(row.gap_seconds) < 21_600) return null;
    const summary = {
      previousEnd: row.previous_end,
      newEntries: Number(row.new_entries),
      newContests: Number(row.new_contests),
      approvedReviews: Number(row.approved_reviews),
      xpGained: Number(row.xp_gained),
    };
    return summary.newEntries || summary.newContests || summary.approvedReviews || summary.xpGained
      ? summary
      : null;
  } catch {
    // Une session précédente ne doit jamais empêcher l'accueil de charger.
    return null;
  }
}

export async function getHomeData() {
  const actorResult = await loadHomeSection("viewer", getOptionalCurrentUser, null);
  const actor = actorResult.value;
  const [
    latestResult,
    trendingResult,
    trainersResult,
    featuredPartnersResult,
    sectionsResult,
    contestsResult,
    viewerRowsResult,
    levelRowsResult,
    sinceLastVisitResult,
  ] = await Promise.all([
    loadHomeSection("latest", () => searchCatalogue({ limit: 12, offset: 0, sort: "recent" }), {
      entries: [],
      total: 0,
    }),
    loadHomeSection("trending", () => searchCatalogue({ limit: 3, offset: 0, sort: "views" }), {
      entries: [],
      total: 0,
    }),
    loadHomeSection("trainers", () => getTrainerRankings("week", 3, 0), []),
    loadHomeSection(
      "partners",
      () => listPartners({ featured: true, includeInactive: false, limit: 1, offset: 0 }),
      { partners: [], total: 0 },
    ),
    loadHomeSection("configuration", listHomeSections, []),
    loadHomeSection(
      "contests",
      () => listPublicContests({ phase: "active", limit: 1, offset: 0 }),
      { contests: [], total: 0 },
    ),
    actor
      ? loadHomeSection(
          "viewer",
          async () =>
            getDb()
              .select({
                id: users.id,
                publicSlug: users.publicSlug,
                displayName: users.displayName,
                telegramUsername: users.telegramUsername,
                profilePhotoUrl: users.profilePhotoUrl,
                profileTitle: users.profileTitle,
                experiencePoints: users.experiencePoints,
                level: users.level,
                role: users.role,
              })
              .from(users)
              .where(eq(users.id, actor.id))
              .limit(1),
          [],
        )
      : Promise.resolve({ value: [], available: actorResult.available }),
    actor
      ? loadHomeSection(
          "viewer",
          () =>
            getDb()
              .select({
                level: levelDefinitions.level,
                threshold: levelDefinitions.threshold,
                title: levelDefinitions.title,
              })
              .from(levelDefinitions)
              .where(eq(levelDefinitions.isActive, true))
              .orderBy(asc(levelDefinitions.level)),
          [],
        )
      : Promise.resolve({ value: [], available: actorResult.available }),
    actor
      ? loadHomeSection("since-last-visit", () => getSinceLastVisit(actor.id), null)
      : Promise.resolve({ value: null, available: actorResult.available }),
  ]);
  const latest = latestResult.value;
  const trending = trendingResult.value;
  const trainers = trainersResult.value;
  const featuredPartners = featuredPartnersResult.value;
  const sections = sectionsResult.value;
  const contests = contestsResult.value;
  const viewerRows = viewerRowsResult.value;
  const levelRows = levelRowsResult.value;
  const sinceLastVisit = sinceLastVisitResult.value;
  const viewer = viewerRows[0];
  const progress = viewer
    ? effectiveExperienceProgress(viewer.experiencePoints, viewer.role, levelRows)
    : null;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const dailyDiscovery = latest.entries.length
    ? latest.entries[dayIndex % latest.entries.length]
    : null;
  return {
    viewer:
      viewer && progress
        ? {
            ...viewer,
            level: progress.level,
            experiencePoints: progress.experiencePoints,
            progress,
          }
        : null,
    sinceLastVisit,
    dailyDiscovery,
    latest: latest.entries.slice(0, 3),
    trendingEntries: trending.entries,
    mostViewed: trending.entries,
    topTrainers: trainers,
    featuredPartners: featuredPartners.partners,
    activeContest: contests.contests[0] ?? null,
    publishedEntryCount: latest.total,
    sections,
    availability: {
      viewer: actorResult.available && viewerRowsResult.available,
      latest: latestResult.available,
      trending: trendingResult.available,
      trainers: trainersResult.available,
      partners: featuredPartnersResult.available,
      configuration: sectionsResult.available,
      contests: contestsResult.available,
      sinceLastVisit: sinceLastVisitResult.available,
    },
  };
}
