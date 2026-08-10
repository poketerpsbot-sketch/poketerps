import { describe, expect, it, vi } from "vitest";

import {
  configureTelegramBot,
  configureTelegramBotForStartup,
  configureTelegramBotWithRetry,
  TelegramSetupError,
} from "@/lib/services/telegram-setup";

const config = {
  botToken: "123456:abcdefghijklmnopqrstuvwxyzABCDEFGH",
  webhookSecret: "webhook_secret-123",
  appUrl: "https://pokedex.example.test/",
};

function success(result: unknown): Response {
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function successfulTelegramFetch() {
  return vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    void _init;
    const method = String(input).split("/").at(-1);
    if (method === "getWebhookInfo") {
      return success({
        url: "https://pokedex.example.test/api/telegram/webhook",
        pending_update_count: 0,
        allowed_updates: ["message", "callback_query"],
      });
    }
    return success(true);
  });
}

describe("Telegram deployment setup", () => {
  it("sets and verifies the webhook, commands and persistent Mini App menu", async () => {
    const fetchImpl = successfulTelegramFetch();

    const info = await configureTelegramBot(config, { fetchImpl });

    expect(info.url).toBe("https://pokedex.example.test/api/telegram/webhook");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const calls = fetchImpl.mock.calls.map(([input, init]) => ({
      method: String(input).split("/").at(-1),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    }));
    expect(calls.find(({ method }) => method === "setWebhook")?.body).toMatchObject({
      url: "https://pokedex.example.test/api/telegram/webhook",
      secret_token: "webhook_secret-123",
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    expect(calls.find(({ method }) => method === "setChatMenuButton")?.body).toMatchObject({
      menu_button: {
        type: "web_app",
        web_app: { url: "https://pokedex.example.test" },
      },
    });
  });

  it("retries transient setup failures with bounded backoff", async () => {
    const succeedingFetch = successfulTelegramFetch();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error_code: 503 }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockImplementation(succeedingFetch);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const info = await configureTelegramBotWithRetry(config, {
      attempts: 2,
      baseDelayMs: 25,
      fetchImpl,
      sleep,
    });

    expect(info.url).toContain("/api/telegram/webhook");
    expect(sleep).toHaveBeenCalledWith(25);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("returns a sanitized failure after startup retries instead of blocking the server", async () => {
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: false,
            error_code: 503,
            description: `temporary failure ${config.botToken}`,
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await configureTelegramBotForStartup(config, {
      attempts: 2,
      baseDelayMs: 10,
      fetchImpl,
      sleep,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        name: "TelegramSetupError",
        message: "Telegram setup failed during setWebhook.",
        method: "setWebhook",
        status: 503,
        errorCode: 503,
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
    expect(JSON.stringify(result)).not.toContain(config.botToken);
  });

  it("reports invalid startup configuration immediately without retrying", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await configureTelegramBotForStartup(
      { ...config, botToken: "invalid-secret-value" },
      { attempts: 3, sleep },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        name: "TelegramSetupConfigurationError",
        message: "TELEGRAM_BOT_TOKEN est invalide.",
      },
    });
    expect(sleep).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("invalid-secret-value");
  });

  it("returns sanitized setup errors without exposing the bot token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: false, error_code: 401, description: `bad ${config.botToken}` }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      );

    const error = await configureTelegramBot(config, { fetchImpl }).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(TelegramSetupError);
    expect(error).toMatchObject({ method: "setWebhook", status: 401, errorCode: 401 });
    expect(String((error as Error).message)).not.toContain(config.botToken);
  });
});
