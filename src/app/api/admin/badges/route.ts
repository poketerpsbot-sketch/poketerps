import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createBadge, listAdminBadges } from "@/lib/services/admin-badges";
import { adminBadgesQuerySchema, badgeInputSchema } from "@/lib/validation/admin-management";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("badge:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, adminBadgesQuerySchema);
    const result = await listAdminBadges(query);
    return apiList(result.badges, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("badge:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const input = await parseJson(request, badgeInputSchema);
    return apiJson(await createBadge(input, actor, requestId), { status: 201 });
  });
}
