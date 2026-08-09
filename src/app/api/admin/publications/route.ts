import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, apiList, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { createPublication, listPublications } from "@/lib/services/publications";
import { createPublicationSchema, publicationQuerySchema } from "@/lib/validation/admin";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("publication:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, publicationQuerySchema);
    const result = await listPublications(query);
    return apiList(result.publications, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("publication:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const input = await parseJson(request, createPublicationSchema);
    return apiJson(await createPublication(input, actor, requestId), { status: 201 });
  });
}
