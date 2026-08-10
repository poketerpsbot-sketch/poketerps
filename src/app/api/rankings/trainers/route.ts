import { NextResponse, type NextRequest } from "next/server";

import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { handleApi, parseSearchParams } from "@/lib/http";
import { getTrainerRankingPage } from "@/lib/services/rankings";
import { trainerRankingQuerySchema } from "@/lib/validation/rankings";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, trainerRankingQuerySchema);
    const actor = await getOptionalCurrentUser();
    const page = await getTrainerRankingPage(query.period, query.limit, query.offset, actor?.id);
    const response = NextResponse.json({
      data: page.items,
      pagination: { limit: query.limit, offset: query.offset, total: page.total },
      currentUser: page.currentUser,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  });
}
