import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createPartner, listPartners } from "@/lib/services/partners";
import { partnerInputSchema, partnerQuerySchema } from "@/lib/validation/partners";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("partner:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, partnerQuerySchema);
    const result = await listPartners({ ...query, includeInactive: true });
    return apiList(result.partners, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("partner:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const input = await parseJson(request, partnerInputSchema);
    return apiJson(await createPartner(input, actor, requestId), { status: 201 });
  });
}
