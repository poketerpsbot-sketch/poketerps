import type { NextRequest } from "next/server";

import { getAnonymousSessionHash } from "@/lib/auth/anonymous";
import { getOptionalCurrentUser } from "@/lib/auth/current-user";
import { getEnv } from "@/lib/env";
import { apiJson, handleApi } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { recordEntryView } from "@/lib/services/engagement";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await getOptionalCurrentUser();
    const anonymousSessionHash = actor ? null : await getAnonymousSessionHash();
    await guardBrowserMutation(
      request,
      rateLimits.view,
      actor?.id ?? anonymousSessionHash ?? undefined,
    );
    const { id } = await context.params;
    return apiJson(
      await recordEntryView(
        uuidSchema.parse(id),
        { userId: actor?.id, anonymousSessionHash },
        getEnv().ENTRY_VIEW_DEDUP_HOURS,
      ),
    );
  });
}
