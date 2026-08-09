import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { listAdminReviews } from "@/lib/services/admin";
import { adminReviewsQuerySchema } from "@/lib/validation/admin";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("review:moderate");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, adminReviewsQuerySchema);
    const result = await listAdminReviews(query);
    return apiList(result.reviews, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
