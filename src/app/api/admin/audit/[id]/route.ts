import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { getTeamAuditLog } from "@/lib/services/admin-user-insights";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser();
    await enforceRateLimit(rateLimits.admin, actor.id);
    const { id } = await context.params;
    return apiJson(await getTeamAuditLog(uuidSchema.parse(id), actor));
  });
}
