import type { NextRequest } from "next/server";

import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { recordContestEvent } from "@/lib/services/contests";
import { idOrSlugSchema } from "@/lib/validation/common";
import { contestEventInputSchema } from "@/lib/validation/contests";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const viewer = await getOptionalCurrentUser();
    await guardBrowserMutation(request, rateLimits.view, viewer?.id);
    const [{ slug }, input] = await Promise.all([
      context.params,
      parseJson(request, contestEventInputSchema),
    ]);
    return apiJson(await recordContestEvent(idOrSlugSchema.parse(slug), input, viewer?.id ?? null));
  });
}
