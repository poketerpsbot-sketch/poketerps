import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { listPublicContests } from "@/lib/services/contests";
import { contestsQuerySchema } from "@/lib/validation/contests";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, contestsQuerySchema);
    const result = await listPublicContests(query);
    return apiList(result.contests, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
