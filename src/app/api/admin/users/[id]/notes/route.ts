import type { NextRequest } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { addAdminUserNote } from "@/lib/services/admin-user-insights";
import { adminUserInternalNoteSchema } from "@/lib/validation/admin-management";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("user:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const [{ id }, input] = await Promise.all([
      context.params,
      parseJson(request, adminUserInternalNoteSchema),
    ]);
    return apiJson(await addAdminUserNote(uuidSchema.parse(id), input.content, actor, requestId), {
      status: 201,
    });
  });
}
