import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { moderateEntry } from "@/lib/services/entries";
import { uuidSchema } from "@/lib/validation/common";
import { moderateEntrySchema } from "@/lib/validation/entries";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("entry:moderate");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, moderateEntrySchema);
    return apiJson(await moderateEntry(uuidSchema.parse(id), input, actor, requestId));
  });
}
