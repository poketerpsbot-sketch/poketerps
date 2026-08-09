import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/rbac";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createAdminMessage } from "@/lib/services/messages";
import { notifyModerationQueue } from "@/lib/services/bot";
import { createMessageSchema } from "@/lib/validation/community";

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    assertPermission(actor.role, "message:create");
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const input = await parseJson(request, createMessageSchema);
    const result = await createAdminMessage(input, actor, requestId);
    await notifyModerationQueue("message", result.id, input.subject);
    return apiJson(result, { status: 201 });
  });
}
