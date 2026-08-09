import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import {
  cancelPublication,
  previewPublication,
  publishPublication,
} from "@/lib/services/publications";
import { publicationActionSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("publication:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const publicationId = uuidSchema.parse(id);
    const { action } = await parseJson(request, publicationActionSchema);
    if (action === "preview") {
      return apiJson(await previewPublication(publicationId, actor, requestId));
    }
    if (action === "publish") {
      return apiJson(await publishPublication(publicationId, actor, requestId));
    }
    return apiJson(await cancelPublication(publicationId, actor, requestId));
  });
}
