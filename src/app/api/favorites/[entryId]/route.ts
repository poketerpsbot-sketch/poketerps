import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { removeFavorite } from "@/lib/services/favorites";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ entryId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.mutation, actor.id);
    const { entryId } = await context.params;
    return apiJson(await removeFavorite(uuidSchema.parse(entryId), actor.id));
  });
}
