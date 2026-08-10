import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { listAdminContestParticipations } from "@/lib/services/admin-contests";
import { uuidSchema } from "@/lib/validation/common";
import { adminContestParticipationsQuerySchema } from "@/lib/validation/contests";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("contest:moderate");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const [{ id }, query] = await Promise.all([
      context.params,
      Promise.resolve(parseSearchParams(request, adminContestParticipationsQuerySchema)),
    ]);
    const result = await listAdminContestParticipations(uuidSchema.parse(id), query);
    return apiList(result.participations, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
