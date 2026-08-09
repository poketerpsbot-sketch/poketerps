import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { assignBadge, listBadgeAssignments } from "@/lib/services/admin-badges";
import { assignBadgeSchema, badgeAssignmentsQuerySchema } from "@/lib/validation/admin-management";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("badge:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const { id } = await context.params;
    const query = parseSearchParams(request, badgeAssignmentsQuerySchema);
    const result = await listBadgeAssignments(uuidSchema.parse(id), query);
    return apiList(result.assignments, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("badge:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, assignBadgeSchema);
    return apiJson(await assignBadge(uuidSchema.parse(id), input, actor, requestId), {
      status: 201,
    });
  });
}
