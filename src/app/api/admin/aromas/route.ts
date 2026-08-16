import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createAroma, listAdminAromaTaxonomy } from "@/lib/services/admin-aromas";
import { aromaInputSchema } from "@/lib/validation/admin-management";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    await requireAdminUser("category:manage");
    return apiJson(await listAdminAromaTaxonomy());
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("category:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const input = await parseJson(request, aromaInputSchema);
    return apiJson(await createAroma(input, actor, requestId), { status: 201 });
  });
}
