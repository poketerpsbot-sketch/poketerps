import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { forbidden } from "@/lib/errors";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { listAdminEntries } from "@/lib/services/admin";
import { adminEntriesQuerySchema } from "@/lib/validation/admin";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("entry:moderate");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, adminEntriesQuerySchema);
    if (actor.role === "MODERATOR" && query.status !== "PENDING_REVIEW") {
      throw forbidden("Un modérateur peut uniquement consulter les nouvelles fiches en attente.");
    }
    const result = await listAdminEntries(query);
    return apiList(result.entries, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
