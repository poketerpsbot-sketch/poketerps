import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { removeFavorite } from "@/lib/services/favorites";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ entryId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.mutation, actor.id);
    const { entryId } = await context.params;
    const parsedEntryId = uuidSchema.parse(entryId);
    const result = await removeFavorite(parsedEntryId, actor.id);
    await tryRecordUserActivityEvent({
      userId: actor.id,
      eventType: "FAVORITE",
      entityType: "ENTRY",
      entityId: parsedEntryId,
      metadata: { favorited: false },
    });
    return apiJson(result);
  });
}
