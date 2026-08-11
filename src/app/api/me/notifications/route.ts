import type { NextRequest } from "next/server";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { apiJson, handleApi, parseJson, parseSearchParams } from "@/lib/http";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import { listUserNotifications, markUserNotificationsRead } from "@/lib/services/notifications";
import { markNotificationsReadSchema, notificationQuerySchema } from "@/lib/validation/community";

export async function GET(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    const query = parseSearchParams(request, notificationQuerySchema);
    return apiJson(await listUserNotifications(actor.id, query));
  });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const actor = await requireCurrentUser();
    await guardBrowserMutation(request, rateLimits.mutation, actor.id);
    const input = await parseJson(request, markNotificationsReadSchema);
    return apiJson(await markUserNotificationsRead(actor.id, input));
  });
}
