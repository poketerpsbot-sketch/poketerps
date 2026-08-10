import "server-only";

import type { UserRole } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  buildWelcomeMenu,
  telegramCommandsForRole,
  telegramRoleBadge,
} from "@/lib/services/bot-pure";

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
};

export type InlineKeyboardMarkup = { inline_keyboard: InlineKeyboardButton[][] };

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number };
};

export async function telegramRequest<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${getEnv().TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: "no-store",
      },
    );
    const result = (await response.json().catch(() => null)) as TelegramResponse<T> | null;
    if (!response.ok || !result?.ok || result.result === undefined) {
      throw new AppError("TELEGRAM_API_ERROR", "Telegram est momentanément indisponible.", 502, {
        expose: false,
        details: { method, status: response.status, errorCode: result?.error_code },
      });
    }
    return result.result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("TELEGRAM_API_ERROR", "Telegram est momentanément indisponible.", 502, {
      cause: error,
      expose: false,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<TelegramMessage> {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export function sendTelegramPhoto(
  chatId: number | string,
  photo: string,
  caption: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<TelegramMessage> {
  return telegramRequest("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    show_alert: showAlert,
  });
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type TelegramWelcomeIdentity = {
  displayName: string;
  username?: string | null;
  role: UserRole;
};

export async function setTelegramCommandMenuForRole(chatId: number, role: UserRole): Promise<void> {
  await telegramRequest("setMyCommands", {
    commands: telegramCommandsForRole(role),
    scope: { type: "chat", chat_id: chatId },
  });
}

export async function sendWelcomeMessage(
  chatId: number,
  identity?: TelegramWelcomeIdentity,
): Promise<void> {
  const env = getEnv();
  const identityLine = identity
    ? `\n<b>${escapeTelegramHtml(identity.displayName)}</b>${identity.username ? ` (@${escapeTelegramHtml(identity.username)})` : ""} · ${telegramRoleBadge(identity.role)}\n`
    : "";
  const caption = `<b>🌿 Bienvenue dans ${escapeTelegramHtml(env.APP_DISPLAY_NAME)}</b>${identityLine}\nLe Pokédex communautaire où chaque découverte compte.\n\n🔎 <b>Explore</b> les fiches détaillées et retrouve rapidement une capture.\n📸 <b>Propose</b> tes propres découvertes à l’équipe de validation.\n🏆 <b>Progresse</b> dans les classements, gagne de l’XP et collectionne des badges.\n🎯 <b>Participe</b> aux concours organisés par la communauté.\n🤝 <b>Échange</b> avec les autres Dresseurs et découvre nos partenaires.\n\nChoisis une action ci-dessous pour commencer.`;
  const keyboard: InlineKeyboardMarkup = buildWelcomeMenu(
    {
      appUrl: env.NEXT_PUBLIC_APP_URL,
      ...(env.TELEGRAM_CHANNEL_URL ? { channelUrl: env.TELEGRAM_CHANNEL_URL } : {}),
      ...(env.TELEGRAM_CHAT_URL ? { chatUrl: env.TELEGRAM_CHAT_URL } : {}),
      ...(env.INSTAGRAM_URL ? { instagramUrl: env.INSTAGRAM_URL } : {}),
    },
    identity?.role,
  );
  if (identity) {
    try {
      await setTelegramCommandMenuForRole(chatId, identity.role);
    } catch (error) {
      logger.warn("telegram_scoped_commands_failed", { chatId, role: identity.role, error });
    }
  }
  try {
    await sendTelegramPhoto(
      chatId,
      `${env.NEXT_PUBLIC_APP_URL}/bot-welcome.png`,
      caption,
      keyboard,
    );
  } catch (error) {
    logger.warn("telegram_welcome_photo_failed", { chatId, error });
    await sendTelegramMessage(chatId, caption, keyboard);
  }
}

export async function notifyTelegramAdmins(
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const env = getEnv();
  const recipients = [
    ...new Set([
      ...env.TELEGRAM_OWNER_IDS,
      ...env.TELEGRAM_ADMIN_IDS,
      ...env.TELEGRAM_MODERATOR_IDS,
    ]),
  ];
  const results = await Promise.allSettled(
    recipients.map((chatId) => sendTelegramMessage(chatId, text, replyMarkup)),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.warn("telegram_admin_notification_failed", {
        chatId: recipients[index],
        error: result.reason,
      });
    }
  });
}
