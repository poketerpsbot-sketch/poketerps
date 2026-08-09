import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { updateAdminMessage } from "@/lib/services/messages";
import { uuidSchema } from "@/lib/validation/common";
import { updateMessageSchema } from "@/lib/validation/community";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("message:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, updateMessageSchema);
    return apiJson(await updateAdminMessage(uuidSchema.parse(id), input, actor, requestId));
  });
}
