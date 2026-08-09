import "server-only";

import { asc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { homeSections } from "@/lib/db/schema";
import { searchCatalogue } from "@/lib/services/catalogue";
import { listCategories } from "@/lib/services/categories";
import { listPartners } from "@/lib/services/partners";
import { getTrainerRankings } from "@/lib/services/rankings";

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

export async function getHomeData() {
  const baseQuery = { limit: 8, offset: 0, sort: "recent" as const };
  const [latest, viewed, liked, rated, categories, trainers, featuredPartners, sections] =
    await Promise.all([
      searchCatalogue(baseQuery),
      searchCatalogue({ ...baseQuery, sort: "views" }),
      searchCatalogue({ ...baseQuery, sort: "likes" }),
      searchCatalogue({ ...baseQuery, sort: "rating" }),
      listCategories(),
      getTrainerRankings("week", 5, 0),
      listPartners({ featured: true, includeInactive: false, limit: 4, offset: 0 }),
      listHomeSections(),
    ]);
  return {
    latest: latest.entries,
    mostViewed: viewed.entries,
    mostLiked: liked.entries,
    bestRated: rated.entries,
    categories,
    topTrainers: trainers,
    featuredPartners: featuredPartners.partners,
    sections,
  };
}
