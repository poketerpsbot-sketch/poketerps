import type { NextRequest } from "next/server";

import { getOptionalCurrentUser, requireCurrentUser } from "@/lib/auth/current-user";
import { assertPermission } from "@/lib/auth/rbac";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { getEntryByIdOrSlug } from "@/lib/services/catalogue";
import { softDeleteEntry, updateEntry } from "@/lib/services/entries";
import { idOrSlugSchema, uuidSchema } from "@/lib/validation/common";
import { updateEntrySchema } from "@/lib/validation/entries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const { id } = await context.params;
    const identifier = idOrSlugSchema.parse(id);
    return apiJson(await getEntryByIdOrSlug(identifier, await getOptionalCurrentUser()));
  });
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    assertPermission(actor.role, "entry:update:own");
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const { id } = await context.params;
    const entryId = uuidSchema.parse(id);
    const input = await parseJson(request, updateEntrySchema);
    return apiJson(await updateEntry(entryId, input, actor, requestId));
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireCurrentUser();
    assertPermission(actor.role, "entry:update:own");
    await guardBrowserMutation(request, rateLimits.submission, actor.id);
    const { id } = await context.params;
    await softDeleteEntry(uuidSchema.parse(id), actor, requestId);
    return apiJson({ deleted: true });
  });
}
