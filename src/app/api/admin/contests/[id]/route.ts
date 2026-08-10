import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { deleteContest, getAdminContest, updateContest } from "@/lib/services/admin-contests";
import { uuidSchema } from "@/lib/validation/common";
import { updateContestSchema } from "@/lib/validation/contests";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("contest:moderate");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const { id } = await context.params;
    return apiJson(await getAdminContest(uuidSchema.parse(id)));
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("contest:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const [{ id }, input] = await Promise.all([
      context.params,
      parseJson(request, updateContestSchema),
    ]);
    return apiJson(await updateContest(uuidSchema.parse(id), input, actor, requestId));
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("contest:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    return apiJson(await deleteContest(uuidSchema.parse(id), actor, requestId));
  });
}
