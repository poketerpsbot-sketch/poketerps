import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { listAdminUsers } from "@/lib/services/admin-users";
import { adminUsersQuerySchema } from "@/lib/validation/admin-management";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("user:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, adminUsersQuerySchema);
    const result = await listAdminUsers(query);
    return apiList(result.users, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
