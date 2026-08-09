import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { softDeletePartner, updatePartner } from "@/lib/services/partners";
import { uuidSchema } from "@/lib/validation/common";
import { updatePartnerSchema } from "@/lib/validation/partners";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("partner:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, updatePartnerSchema);
    return apiJson(await updatePartner(uuidSchema.parse(id), input, actor, requestId));
  });
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("partner:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    await softDeletePartner(uuidSchema.parse(id), actor, requestId);
    return apiJson({ deleted: true });
  });
}
