import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { getTeamActivity } from "@/lib/services/admin-user-insights";
import { teamActivityQuerySchema } from "@/lib/validation/admin-management";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser();
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, teamActivityQuerySchema);
    return apiJson(await getTeamActivity(query, actor));
  });
}
