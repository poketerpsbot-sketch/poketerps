import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { updateAdminUser } from "@/lib/services/admin-users";
import { getAdminUserDetail } from "@/lib/services/admin-user-insights";
import { updateAdminUserSchema } from "@/lib/validation/admin-management";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser();
    await enforceRateLimit(rateLimits.admin, actor.id);
    const { id } = await context.params;
    return apiJson(await getAdminUserDetail(uuidSchema.parse(id), actor));
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("user:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, updateAdminUserSchema);
    return apiJson(await updateAdminUser(uuidSchema.parse(id), input, actor, requestId));
  });
}
