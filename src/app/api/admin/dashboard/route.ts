import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { getAdminDashboard } from "@/lib/services/admin";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("audit:read");
    await enforceRateLimit(rateLimits.admin, actor.id);
    return apiJson(await getAdminDashboard());
  });
}
