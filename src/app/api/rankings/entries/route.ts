import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { getEntryRankings } from "@/lib/services/rankings";
import { entryRankingQuerySchema } from "@/lib/validation/rankings";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, entryRankingQuerySchema);
    return apiList(await getEntryRankings(query.metric, query.period, query.limit, query.offset), {
      limit: query.limit,
      offset: query.offset,
    });
  });
}
