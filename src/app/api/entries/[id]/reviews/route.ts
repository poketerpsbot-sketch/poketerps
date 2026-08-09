import type { NextRequest } from "next/server";

import { getOptionalCurrentUser, requireCurrentUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/rbac";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { getEntryByIdOrSlug } from "@/lib/services/catalogue";
import { createReview, listPublishedReviews } from "@/lib/services/reviews";
import { notifyModerationQueue } from "@/lib/services/bot";
import { idOrSlugSchema } from "@/lib/validation/common";
import { paginationSchema } from "@/lib/validation/common";
import { createReviewSchema } from "@/lib/validation/community";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const query = parseSearchParams(request, paginationSchema);
    const { id } = await context.params;
    const entry = await getEntryByIdOrSlug(
      idOrSlugSchema.parse(id),
      await getOptionalCurrentUser(),
    );
    const reviews = await listPublishedReviews(entry.id, query.limit, query.offset);
    return apiList(reviews, query);
  });
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    assertPermission(actor.role, "review:create");
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const { id } = await context.params;
    const entry = await getEntryByIdOrSlug(idOrSlugSchema.parse(id), actor);
    const input = await parseJson(request, createReviewSchema);
    const result = await createReview(entry.id, input, actor, requestId);
    await notifyModerationQueue("review", result.id, `${entry.name} · ${input.overallRating}/10`);
    return apiJson(result, { status: 201 });
  });
}
