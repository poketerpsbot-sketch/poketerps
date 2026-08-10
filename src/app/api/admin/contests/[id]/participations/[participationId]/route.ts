import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { moderateContestParticipation } from "@/lib/services/admin-contests";
import { uuidSchema } from "@/lib/validation/common";
import { moderateContestParticipationSchema } from "@/lib/validation/contests";

type RouteContext = { params: Promise<{ id: string; participationId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("contest:moderate");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const [{ id, participationId }, input] = await Promise.all([
      context.params,
      parseJson(request, moderateContestParticipationSchema),
    ]);
    return apiJson(
      await moderateContestParticipation(
        uuidSchema.parse(id),
        uuidSchema.parse(participationId),
        input,
        actor,
        requestId,
      ),
    );
  });
}
