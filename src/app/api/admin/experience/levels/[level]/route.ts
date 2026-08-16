import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { forbidden, notFound } from "@/lib/errors";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { updateLevelDefinition } from "@/lib/services/admin-experience";
import { updateLevelDefinitionSchema } from "@/lib/validation/experience";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ level: string }> },
): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("settings:manage");
    if (actor.role !== "OWNER") throw forbidden("Réservé au propriétaire.");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { level: rawLevel } = await context.params;
    const level = Number(rawLevel);
    if (!Number.isInteger(level) || level < 1) throw notFound("Niveau");
    const input = await parseJson(request, updateLevelDefinitionSchema);
    return apiJson(await updateLevelDefinition(level, input, actor, requestId));
  });
}
