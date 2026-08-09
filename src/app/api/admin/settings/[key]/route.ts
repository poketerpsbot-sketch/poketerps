import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { updateAdminSetting } from "@/lib/services/admin-settings";
import { settingKeySchema, updateSettingSchema } from "@/lib/validation/admin-management";

type RouteContext = { params: Promise<{ key: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("settings:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { key } = await context.params;
    const input = await parseJson(request, updateSettingSchema);
    return apiJson(await updateAdminSetting(settingKeySchema.parse(key), input, actor, requestId));
  });
}
