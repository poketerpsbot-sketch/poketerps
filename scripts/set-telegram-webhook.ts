import { config } from "dotenv";

import {
  configureTelegramBotForStartup,
  configureTelegramBotWithRetry,
  sanitizeTelegramSetupError,
  TelegramSetupConfigurationError,
  type SanitizedTelegramSetupError,
  type TelegramSetupConfig,
  type TelegramWebhookInfo,
} from "../src/lib/services/telegram-setup";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const startupMode = process.argv.includes("--startup");

function readConfig(): TelegramSetupConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!botToken || !webhookSecret || !appUrl) {
    throw new TelegramSetupConfigurationError(
      "TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et NEXT_PUBLIC_APP_URL sont requis.",
    );
  }
  const telegramIds = (value: string | undefined): number[] =>
    value
      ? [
          ...new Set(
            value
              .split(",")
              .map((item) => Number(item.trim()))
              .filter(Number.isSafeInteger),
          ),
        ]
      : [];
  return {
    botToken,
    webhookSecret,
    appUrl,
    ownerIds: telegramIds(process.env.TELEGRAM_OWNER_IDS),
    adminIds: telegramIds(process.env.TELEGRAM_ADMIN_IDS),
    moderatorIds: telegramIds(process.env.TELEGRAM_MODERATOR_IDS),
  };
}

function logSuccess(info: TelegramWebhookInfo): void {
  console.log(
    `Webhook Telegram vérifié sur ${info.url} (${info.pending_update_count} mise(s) à jour en attente).`,
  );
}

function logFailure(error: SanitizedTelegramSetupError): void {
  console.error(
    JSON.stringify({
      level: "error",
      message: "telegram_setup_failed",
      context: {
        mode: startupMode ? "startup" : "manual",
        continuing: startupMode,
        error,
      },
    }),
  );
}

const options = {
  attempts: 3,
  onRetry: (_error: unknown, attempt: number, delayMs: number) => {
    console.warn(
      `Configuration Telegram échouée (tentative ${attempt}), nouvel essai dans ${delayMs} ms.`,
    );
  },
};

async function main(): Promise<void> {
  try {
    const telegramConfig = readConfig();
    if (startupMode) {
      const result = await configureTelegramBotForStartup(telegramConfig, options);
      if (result.ok) logSuccess(result.info);
      else logFailure(result.error);
    } else {
      logSuccess(await configureTelegramBotWithRetry(telegramConfig, options));
    }
  } catch (error) {
    logFailure(sanitizeTelegramSetupError(error));
    if (!startupMode) process.exitCode = 1;
  }
}

void main();
