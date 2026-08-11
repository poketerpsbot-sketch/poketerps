import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { listTeamAuditLogs } from "@/lib/services/admin-user-insights";
import { auditQuerySchema } from "@/lib/validation/admin";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser();
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, auditQuerySchema);
    const result = await listTeamAuditLogs(query, actor);
    return apiList(result.logs, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
