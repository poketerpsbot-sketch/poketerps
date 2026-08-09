import type { NextRequest } from "next/server";

import { isValidTelegramWebhookSecret } from "@/lib/auth/telegram-webhook";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { apiJson, handleApi, parseJson } from "@/lib/http";
import { logger } from "@/lib/logger";
import { upsertTrustedTelegramUser } from "@/lib/services/auth";
import { processTelegramUpdate } from "@/lib/services/bot";
import {
  claimTelegramUpdate,
  completeTelegramUpdate,
  failTelegramUpdate,
} from "@/lib/services/telegram-updates";
import { answerTelegramCallback, sendTelegramMessage } from "@/lib/services/telegram-client";
import { telegramUpdateSchema } from "@/lib/validation/telegram";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  return handleApi(request, async () => {
    const suppliedSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (!isValidTelegramWebhookSecret(suppliedSecret, getEnv().TELEGRAM_WEBHOOK_SECRET)) {
      throw new AppError("INVALID_WEBHOOK_SECRET", "Webhook non autorisé.", 401);
    }
    const update = await parseJson(request, telegramUpdateSchema, 128_000);
    const claimed = await claimTelegramUpdate(update.update_id);
    if (!claimed) return apiJson({ accepted: true, duplicate: true });

    try {
      const sender = update.callback_query?.from ?? update.message?.from;
      if (sender) {
        const actor = await upsertTrustedTelegramUser(sender);
        await processTelegramUpdate(update, actor);
      }
      await completeTelegramUpdate(update.update_id);
      return apiJson({ accepted: true });
    } catch (error) {
      if (error instanceof AppError && error.status < 500) {
        try {
          if (update.callback_query) {
            await answerTelegramCallback(update.callback_query.id, error.message, true);
          } else if (update.message) {
            await sendTelegramMessage(update.message.chat.id, error.message);
          }
        } catch (notificationError) {
          logger.warn("telegram_business_error_notification_failed", {
            updateId: update.update_id,
            notificationError,
          });
        }
        await completeTelegramUpdate(update.update_id);
        return apiJson({ accepted: true, handledError: error.code });
      }
      await failTelegramUpdate(update.update_id, error);
      throw error;
    }
  });
}
