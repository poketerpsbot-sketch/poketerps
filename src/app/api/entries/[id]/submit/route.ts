import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/rbac";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { submitEntry } from "@/lib/services/entries";
import { notifyModerationQueue } from "@/lib/services/bot";
import { tryRecordUserActivityEvent } from "@/lib/services/user-activity";
import { uuidSchema } from "@/lib/validation/common";
import { submitEntrySchema } from "@/lib/validation/entries";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    assertPermission(actor.role, "entry:update:own");
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, submitEntrySchema);
    const entryId = uuidSchema.parse(id);
    const result = await submitEntry(entryId, actor, input.note, requestId);
    await notifyModerationQueue("entry", entryId, `Proposition de ${actor.displayName}`);
    await tryRecordUserActivityEvent({
      userId: actor.id,
      eventType: "ENTRY_SUBMIT",
      entityType: "ENTRY",
      entityId: entryId,
    });
    return apiJson(result);
  });
}
