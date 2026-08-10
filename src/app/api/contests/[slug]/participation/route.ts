import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { joinContest, withdrawFromContest } from "@/lib/services/contests";
import { idOrSlugSchema } from "@/lib/validation/common";
import { contestParticipationInputSchema } from "@/lib/validation/contests";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const [{ slug }, input] = await Promise.all([
      context.params,
      parseJson(request, contestParticipationInputSchema),
    ]);
    return apiJson(await joinContest(idOrSlugSchema.parse(slug), input, actor, requestId), {
      status: 201,
    });
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const { slug } = await context.params;
    return apiJson(await withdrawFromContest(idOrSlugSchema.parse(slug), actor, requestId));
  });
}
