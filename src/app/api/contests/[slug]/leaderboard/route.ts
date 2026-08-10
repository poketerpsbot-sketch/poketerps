import type { NextRequest } from "next/server";

import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { getContestLeaderboard } from "@/lib/services/contests";
import { idOrSlugSchema } from "@/lib/validation/common";
import { contestLeaderboardQuerySchema } from "@/lib/validation/contests";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const { slug } = await context.params;
    const query = parseSearchParams(request, contestLeaderboardQuerySchema);
    const result = await getContestLeaderboard(idOrSlugSchema.parse(slug), query);
    return apiList(result.items, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
