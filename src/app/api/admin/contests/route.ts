import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createContest, listAdminContests } from "@/lib/services/admin-contests";
import { adminContestsQuerySchema, createContestSchema } from "@/lib/validation/contests";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("contest:moderate");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, adminContestsQuerySchema);
    const result = await listAdminContests(query);
    return apiList(result.contests, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("contest:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const input = await parseJson(request, createContestSchema);
    return apiJson(await createContest(input, actor, requestId), { status: 201 });
  });
}
