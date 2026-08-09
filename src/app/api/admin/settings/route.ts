import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { listAdminSettings } from "@/lib/services/admin-settings";
import { adminSettingsQuerySchema } from "@/lib/validation/admin-management";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("settings:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, adminSettingsQuerySchema);
    const result = await listAdminSettings(query);
    return apiList(result.settings, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
