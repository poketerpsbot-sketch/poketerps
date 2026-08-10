import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { removeContestWinner } from "@/lib/services/admin-contests";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string; winnerId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("contest:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id, winnerId } = await context.params;
    return apiJson(
      await removeContestWinner(uuidSchema.parse(id), uuidSchema.parse(winnerId), actor, requestId),
    );
  });
}
