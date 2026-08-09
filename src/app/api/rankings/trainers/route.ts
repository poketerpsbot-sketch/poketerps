import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { getTrainerRankings } from "@/lib/services/rankings";
import { trainerRankingQuerySchema } from "@/lib/validation/rankings";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, trainerRankingQuerySchema);
    return apiList(await getTrainerRankings(query.period, query.limit, query.offset), {
      limit: query.limit,
      offset: query.offset,
    });
  });
}
