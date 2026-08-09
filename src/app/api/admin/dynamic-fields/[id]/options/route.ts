import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createDynamicFieldOption, listDynamicFieldOptions } from "@/lib/services/admin-taxonomy";
import {
  dynamicFieldOptionInputSchema,
  dynamicFieldOptionQuerySchema,
} from "@/lib/validation/admin-management";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("category:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const { id } = await context.params;
    const query = parseSearchParams(request, dynamicFieldOptionQuerySchema);
    const result = await listDynamicFieldOptions(uuidSchema.parse(id), query);
    return apiList(result.options, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("category:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, dynamicFieldOptionInputSchema);
    return apiJson(await createDynamicFieldOption(uuidSchema.parse(id), input, actor, requestId), {
      status: 201,
    });
  });
}
