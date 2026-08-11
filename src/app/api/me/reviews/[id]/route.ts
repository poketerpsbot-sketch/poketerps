import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { getEditableReview, resubmitReview } from "@/lib/services/reviews";
import { uuidSchema } from "@/lib/validation/common";
import { resubmitReviewSchema } from "@/lib/validation/community";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    const { id } = await context.params;
    return apiJson(await getEditableReview(uuidSchema.parse(id), actor));
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, resubmitReviewSchema);
    return apiJson(await resubmitReview(uuidSchema.parse(id), input, actor, requestId));
  });
}
