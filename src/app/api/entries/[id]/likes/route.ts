import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { setEntryLike } from "@/lib/services/engagement";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

async function mutate(
  request: NextRequest,
  context: RouteContext,
  desired: boolean,
): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.mutation, actor.id);
    const { id } = await context.params;
    const entryId = uuidSchema.parse(id);
    const result = await setEntryLike(entryId, actor.id, desired);
    await tryRecordUserActivityEvent({
      userId: actor.id,
      eventType: desired ? "LIKE" : "UNLIKE",
      entityType: "ENTRY",
      entityId: entryId,
    });
    return apiJson(result);
  });
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  return mutate(request, context, true);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return mutate(request, context, false);
}
