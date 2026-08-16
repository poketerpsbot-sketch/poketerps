import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { forbidden } from "@/lib/errors";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { updateExperienceRule } from "@/lib/services/admin-experience";
import { updateExperienceRuleSchema } from "@/lib/validation/experience";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ key: string }> },
): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("settings:manage");
    if (actor.role !== "OWNER") throw forbidden("Réservé au propriétaire.");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { key } = await context.params;
    const input = await parseJson(request, updateExperienceRuleSchema);
    return apiJson(await updateExperienceRule(key, input, actor, requestId));
  });
}
