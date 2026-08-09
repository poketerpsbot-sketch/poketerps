import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createDynamicField, listAdminDynamicFields } from "@/lib/services/admin-taxonomy";
import {
  adminDynamicFieldQuerySchema,
  dynamicFieldInputSchema,
} from "@/lib/validation/admin-management";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("category:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, adminDynamicFieldQuerySchema);
    const result = await listAdminDynamicFields(query);
    return apiList(result.fields, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("category:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const input = await parseJson(request, dynamicFieldInputSchema);
    return apiJson(await createDynamicField(input, actor, requestId), { status: 201 });
  });
}
