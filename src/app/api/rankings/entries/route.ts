import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { getEntryRankingPage } from "@/lib/services/rankings";
import { entryRankingQuerySchema } from "@/lib/validation/rankings";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, entryRankingQuerySchema);
    const page = await getEntryRankingPage(query.metric, query.period, query.limit, query.offset);
    return apiList(page.items, {
      limit: query.limit,
      offset: query.offset,
      total: page.total,
    });
  });
}
