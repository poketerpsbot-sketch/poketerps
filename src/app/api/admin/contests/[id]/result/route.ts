import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { publishContestResult } from "@/lib/services/admin-contests";
import { uuidSchema } from "@/lib/validation/common";
import { publishContestResultSchema } from "@/lib/validation/contests";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("contest:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const [{ id }, input] = await Promise.all([
      context.params,
      parseJson(request, publishContestResultSchema),
    ]);
    return apiJson(await publishContestResult(uuidSchema.parse(id), input, actor, requestId));
  });
}
