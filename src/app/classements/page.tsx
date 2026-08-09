import type { Metadata } from "next";
import { serverApi, unwrapList } from "@/components/data/server-api";
import type { EntryRankingDto, EntrySummaryDto, TrainerRankingDto } from "@/components/data/types";
import {
  RankingsView,
  type RankingMetric,
  type RankingPeriod,
} from "@/components/rankings/rankings-view";

export const metadata: Metadata = { title: "Classements" };

type SearchParams = { period?: string | string[]; metric?: string | string[] };

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
  const [trainersResult, entriesResult] = await Promise.all([
    serverApi<unknown>(`/api/rankings/trainers?period=${selectedPeriod}`),
    serverApi<unknown>(`/api/rankings/entries?period=${selectedPeriod}&metric=${selectedMetric}`),
  ]);

  return (
    <RankingsView
      period={selectedPeriod}
      metric={selectedMetric}
      trainers={unwrapList<TrainerRankingDto>(trainersResult.data, ["trainers", "rankings"]).map(
        normalizeTrainer,
      )}
      entries={unwrapList<EntryRankingDto | EntrySummaryDto>(entriesResult.data, [
        "entries",
        "rankings",
      ])}
      trainersError={trainersResult.error}
      entriesError={entriesResult.error}
    />
  );
}
