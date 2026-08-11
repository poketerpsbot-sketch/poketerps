import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { moderateCorrectionSubmission } from "@/lib/services/admin-queues";
import { moderateCorrectionSubmissionSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("entry:moderate");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const input = await parseJson(request, moderateCorrectionSubmissionSchema);
    return apiJson(
      await moderateCorrectionSubmission(uuidSchema.parse(id), input, actor, requestId),
    );
  });
}
