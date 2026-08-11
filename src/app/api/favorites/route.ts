import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { addFavorite, listFavorites } from "@/lib/services/favorites";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import { favoriteSchema } from "@/lib/validation/community";
import { paginationSchema } from "@/lib/validation/common";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    const query = parseSearchParams(request, paginationSchema);
    return apiList(await listFavorites(actor.id, query.limit, query.offset), query);
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.mutation, actor.id);
    const input = await parseJson(request, favoriteSchema);
    const result = await addFavorite(input.entryId, actor.id);
    await tryRecordUserActivityEvent({
      userId: actor.id,
      eventType: "FAVORITE",
      entityType: "ENTRY",
      entityId: input.entryId,
      metadata: { favorited: true },
    });
    return apiJson(result, { status: 201 });
  });
}
