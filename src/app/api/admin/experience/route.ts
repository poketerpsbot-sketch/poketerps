import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { forbidden } from "@/lib/errors";
import { apiJson, handleApi } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { rateLimits } from "@/lib/security/request-guard";
import { getExperienceConfiguration } from "@/lib/services/admin-experience";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireAdminUser("settings:manage");
    if (actor.role !== "OWNER") throw forbidden("Réservé au propriétaire.");
    await enforceRateLimit(rateLimits.admin, actor.id);
    return apiJson(await getExperienceConfiguration());
  });
}
