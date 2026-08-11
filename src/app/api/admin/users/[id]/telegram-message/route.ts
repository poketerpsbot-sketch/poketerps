import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { sendAdminUserTelegramMessage } from "@/lib/services/admin-user-insights";
import { adminUserTelegramMessageSchema } from "@/lib/validation/admin-management";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("user:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const [{ id }, input] = await Promise.all([
      context.params,
      parseJson(request, adminUserTelegramMessageSchema),
    ]);
    return apiJson(
      await sendAdminUserTelegramMessage(uuidSchema.parse(id), input.text, actor, requestId),
      { status: 201 },
    );
  });
}
