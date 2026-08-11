import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { forbidden } from "@/lib/errors";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { moderateEntry, permanentlyDeleteEntry, softDeleteEntry } from "@/lib/services/entries";
import { uuidSchema } from "@/lib/validation/common";
import { moderateEntrySchema } from "@/lib/validation/entries";
import { permanentDeleteEntrySchema } from "@/lib/validation/admin";

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

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";
    const actor = await requireAdminUser(permanent ? "entry:delete:permanent" : "entry:update:any");
    if (!permanent && actor.role !== "OWNER" && actor.role !== "ADMIN") throw forbidden();
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const entryId = uuidSchema.parse(id);
    if (permanent) {
      const input = await parseJson(request, permanentDeleteEntrySchema);
      return apiJson(await permanentlyDeleteEntry(entryId, input.confirmation, actor, requestId));
    }
    await softDeleteEntry(entryId, actor, requestId, "WEB_ADMIN");
    return apiJson({ deleted: true });
  });
}
