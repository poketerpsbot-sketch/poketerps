import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiList, handleApi, parseSearchParams } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { listAdminMessages } from "@/lib/services/messages";
import { messageQuerySchema } from "@/lib/validation/community";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("message:manage");
    await enforceRateLimit(rateLimits.admin, actor.id);
    const query = parseSearchParams(request, messageQuerySchema);
    const result = await listAdminMessages(query);
    return apiList(result.messages, {
      limit: query.limit,
      offset: query.offset,
      total: result.total,
    });
  });
}
