import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createMicronPreset, listAdminMicronPresets } from "@/lib/services/admin-taxonomy";
import { micronPresetInputSchema } from "@/lib/validation/admin-management";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("category:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const presets = await listAdminMicronPresets(true);
    return apiList(presets, { limit: presets.length, offset: 0, total: presets.length });
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("category:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const input = await parseJson(request, micronPresetInputSchema);
    return apiJson(await createMicronPreset(input, actor, requestId), { status: 201 });
  });
}
