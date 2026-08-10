import type { Metadata } from "next";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { EntryRankingDto, EntrySummaryDto, TrainerRankingDto } from "@/components/data/types";
import {
  RankingsView,
  type RankingMetric,
  type RankingPeriod,
} from "@/components/rankings/rankings-view";

export const metadata: Metadata = { title: "Classements" };

type SearchParams = {
  period?: string | string[];
  metric?: string | string[];
  trainersPage?: string | string[];
  entriesPage?: string | string[];
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function period(value?: string | string[]): RankingPeriod {
  const candidate = first(value);
  return candidate === "month" || candidate === "all" ? candidate : "week";
}

function metric(value?: string | string[]): RankingMetric {
  const candidate = first(value);
  return candidate === "likes" || candidate === "rating" || candidate === "recent"
    ? candidate
    : "views";
}

function pageNumber(value?: string | string[]) {
  const parsed = Number.parseInt(first(value) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type Pagination = { limit: number; offset: number; total: number };

function paginationFrom(payload: unknown, fallbackLimit: number): Pagination {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { limit: fallbackLimit, offset: 0, total: 0 };
  }
  const candidate = (payload as Record<string, unknown>).pagination;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { limit: fallbackLimit, offset: 0, total: 0 };
  }
  const values = candidate as Record<string, unknown>;
  return {
    limit: typeof values.limit === "number" ? values.limit : fallbackLimit,
    offset: typeof values.offset === "number" ? values.offset : 0,
    total: typeof values.total === "number" ? values.total : 0,
  };
}

function currentTrainerFrom(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const current = (payload as Record<string, unknown>).currentUser;
  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as TrainerRankingDto)
    : null;
}

function normalizeTrainer(item: TrainerRankingDto): TrainerRankingDto {
  return {
    ...item,
    captures: Number(item.captures ?? item.periodCaptures ?? 0),
    publicSlug: item.publicSlug ?? item.slug,
    telegramUsername: item.telegramUsername ?? item.username,
  };
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const selectedPeriod = period(query.period);
  const selectedMetric = metric(query.metric);
  const trainerPage = pageNumber(query.trainersPage);
  const entryPage = pageNumber(query.entriesPage);
  const limit = 20;
  const [trainersResult, entriesResult] = await Promise.all([
    serverApi<unknown>(
      `/api/rankings/trainers?period=${selectedPeriod}&limit=${limit}&offset=${(trainerPage - 1) * limit}`,
    ),
    serverApi<unknown>(
      `/api/rankings/entries?period=${selectedPeriod}&metric=${selectedMetric}&limit=${limit}&offset=${(entryPage - 1) * limit}`,
    ),
  ]);

  const trainerPagination = paginationFrom(trainersResult.data, limit);
  const entryPagination = paginationFrom(entriesResult.data, limit);

  return (
    <RankingsView
      period={selectedPeriod}
      metric={selectedMetric}
      trainers={unwrapList<TrainerRankingDto>(trainersResult.data, ["trainers", "rankings"]).map(
        normalizeTrainer,
      )}
      currentTrainer={currentTrainerFrom(trainersResult.data)}
      entries={unwrapList<EntryRankingDto | EntrySummaryDto>(entriesResult.data, [
        "entries",
        "rankings",
      ])}
      trainerPage={trainerPage}
      trainerTotal={trainerPagination.total}
      trainerTotalPages={Math.max(1, Math.ceil(trainerPagination.total / trainerPagination.limit))}
      entryPage={entryPage}
      entryTotal={entryPagination.total}
      entryTotalPages={Math.max(1, Math.ceil(entryPagination.total / entryPagination.limit))}
      trainersError={trainersResult.error}
      entriesError={entriesResult.error}
    />
  );
}
