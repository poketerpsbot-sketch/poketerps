import type { NextRequest } from "next/server";
import { after } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { guardBrowserMutation, rateLimits } from "@/lib/security/request-guard";
import {
  cancelPublication,
  previewPublication,
  publishPublication,
} from "@/lib/services/publications";
import { processTelegramBroadcast } from "@/lib/services/telegram-entry-broadcasts";
import { publicationActionSchema } from "@/lib/validation/admin";
import { uuidSchema } from "@/lib/validation/common";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleApi(request, async ({ requestId }) => {
    const actor = await requireAdminUser("publication:manage");
    await guardBrowserMutation(request, rateLimits.admin, actor.id);
    const { id } = await context.params;
    const publicationId = uuidSchema.parse(id);
    const { action } = await parseJson(request, publicationActionSchema);
    if (action === "preview") {
      return apiJson(await previewPublication(publicationId, actor, requestId));
    }
    if (action === "publish") {
      const result = await publishPublication(publicationId, actor, requestId);
      if (result.telegramBroadcastId) {
        const broadcastId = result.telegramBroadcastId;
        after(async () => {
          try {
            await processTelegramBroadcast(broadcastId);
          } catch (error) {
            logger.error("telegram_announcement_broadcast_process_failed", {
              broadcastId,
              error,
            });
          }
        });
      }
      return apiJson(result);
    }
    return apiJson(await cancelPublication(publicationId, actor, requestId));
  });
}
