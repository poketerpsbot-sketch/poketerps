import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { listContestHallOfFame } from "@/lib/services/contests";
import { contestHallOfFameQuerySchema } from "@/lib/validation/contests";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, contestHallOfFameQuerySchema);
    const result = await listContestHallOfFame(query);
    return apiList(result.results, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
