export type TelegramSetupConfig = {
  botToken: string;
  webhookSecret: string;
  appUrl: string;
};

export type TelegramWebhookInfo = {
  url: string;
  pending_update_count: number;
  allowed_updates?: string[];
  last_error_date?: number;
  last_error_message?: string;
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class TelegramSetupConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramSetupConfigurationError";
  }
}

export class TelegramSetupError extends Error {
  readonly method: string;
  readonly status: number;
  readonly errorCode?: number;

  constructor(method: string, status: number, errorCode?: number) {
    super(`Telegram setup failed during ${method}.`);
    this.name = "TelegramSetupError";
    this.method = method;
    this.status = status;
    this.errorCode = errorCode;
  }
}

export type SanitizedTelegramSetupError = {
  name: "TelegramSetupConfigurationError" | "TelegramSetupError" | "Error";
  message: string;
  method?: string;
  status?: number;
  errorCode?: number;
};

export function sanitizeTelegramSetupError(error: unknown): SanitizedTelegramSetupError {
  if (error instanceof TelegramSetupError) {
    return {
      name: "TelegramSetupError",
      message: error.message,
      method: error.method,
      status: error.status,
      ...(error.errorCode === undefined ? {} : { errorCode: error.errorCode }),
    };
  }
  if (error instanceof TelegramSetupConfigurationError) {
    return { name: "TelegramSetupConfigurationError", message: error.message };
  }
  return { name: "Error", message: "Telegram setup failed." };
}

export const telegramBotCommands = [
  { command: "start", description: "Accueil du Pokédex" },
  { command: "app", description: "Ouvrir la Mini App" },
  { command: "search", description: "Scanner le catalogue" },
  { command: "latest", description: "Dernières captures" },
  { command: "ranking", description: "Classements" },
  { command: "profile", description: "Mon profil" },
  { command: "partners", description: "Nos partenaires" },
  { command: "help", description: "Aide" },
  { command: "admin", description: "Administration (autorisés)" },
] as const;

function normalizeConfig(config: TelegramSetupConfig): TelegramSetupConfig {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(config.botToken)) {
    throw new TelegramSetupConfigurationError("TELEGRAM_BOT_TOKEN est invalide.");
  }
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(config.webhookSecret)) {
    throw new TelegramSetupConfigurationError(
      "TELEGRAM_WEBHOOK_SECRET contient des caractères refusés par Telegram.",
    );
  }
  let url: URL;
  try {
    url = new URL(config.appUrl);
  } catch {
    throw new TelegramSetupConfigurationError("NEXT_PUBLIC_APP_URL doit être une URL valide.");
  }
  if (url.protocol !== "https:") {
    throw new TelegramSetupConfigurationError(
      "NEXT_PUBLIC_APP_URL doit utiliser HTTPS pour le webhook Telegram.",
    );
  }
  return { ...config, appUrl: config.appUrl.replace(/\/+$/, "") };
}

async function telegramSetupRequest<T>(
  config: TelegramSetupConfig,
  method: string,
  payload: Record<string, unknown>,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${config.botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => null)) as TelegramApiResponse<T> | null;
    if (!response.ok || !result?.ok || result.result === undefined) {
      throw new TelegramSetupError(method, response.status, result?.error_code);
    }
    return result.result;
  } catch (error) {
    if (error instanceof TelegramSetupError) throw error;
    throw new TelegramSetupError(method, 0);
  } finally {
    clearTimeout(timeout);
  }
}

export async function configureTelegramBot(
  rawConfig: TelegramSetupConfig,
  options: { fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<TelegramWebhookInfo> {
  const config = normalizeConfig(rawConfig);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;
  const webhookUrl = `${config.appUrl}/api/telegram/webhook`;
  const request = <T>(method: string, payload: Record<string, unknown>) =>
    telegramSetupRequest<T>(config, method, payload, fetchImpl, timeoutMs);

  await request<boolean>("setWebhook", {
    url: webhookUrl,
    secret_token: config.webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  await Promise.all([
    request<boolean>("setMyCommands", { commands: telegramBotCommands }),
    request<boolean>("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Ouvrir le Pokédex",
        web_app: { url: config.appUrl },
      },
    }),
  ]);
  const info = await request<TelegramWebhookInfo>("getWebhookInfo", {});
  const allowedUpdates = new Set(info.allowed_updates ?? []);
  if (
    info.url !== webhookUrl ||
    !allowedUpdates.has("message") ||
    !allowedUpdates.has("callback_query")
  ) {
    throw new TelegramSetupError("verifyWebhook", 200);
  }
  return info;
}

export type TelegramSetupRetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

export async function configureTelegramBotWithRetry(
  config: TelegramSetupConfig,
  options: TelegramSetupRetryOptions = {},
): Promise<TelegramWebhookInfo> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 5));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 1_000);
  const sleep =
    options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await configureTelegramBot(config, {
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      });
    } catch (error) {
      lastError = error;
      if (error instanceof TelegramSetupConfigurationError) throw error;
      if (attempt === attempts) break;
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

export type TelegramStartupSetupResult =
  { ok: true; info: TelegramWebhookInfo } | { ok: false; error: SanitizedTelegramSetupError };

export async function configureTelegramBotForStartup(
  config: TelegramSetupConfig,
  options: TelegramSetupRetryOptions = {},
): Promise<TelegramStartupSetupResult> {
  try {
    return { ok: true, info: await configureTelegramBotWithRetry(config, options) };
  } catch (error) {
    return { ok: false, error: sanitizeTelegramSetupError(error) };
  }
}
