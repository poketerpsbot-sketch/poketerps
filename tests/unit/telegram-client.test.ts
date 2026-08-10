import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { sendWelcomeMessage, telegramRequest } from "@/lib/services/telegram-client";

function telegramSuccess(messageId: number): Response {
  return new Response(
    JSON.stringify({ ok: true, result: { message_id: messageId, chat: { id: 42 } } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Telegram welcome message", () => {
  it("uses sendPhoto with the generated welcome image and an HTML caption", async () => {
    const fetchMock = vi.fn().mockResolvedValue(telegramSuccess(1));
    vi.stubGlobal("fetch", fetchMock);

    await sendWelcomeMessage(42);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(url).toMatch(/\/sendPhoto$/);
    expect(body).toMatchObject({
      chat_id: 42,
      photo: "https://pokedex.example.test/bot-welcome.png",
      parse_mode: "HTML",
    });
    expect(String(body.caption)).toContain("Bienvenue dans");
  });

  it("falls back to sendMessage when Telegram cannot fetch the image", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error_code: 400 }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(telegramSuccess(2));
    vi.stubGlobal("fetch", fetchMock);

    await sendWelcomeMessage(42);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/sendPhoto$/);
    expect(fetchMock.mock.calls[1]?.[0]).toMatch(/\/sendMessage$/);
    const fallbackBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      reply_markup: { inline_keyboard: Array<Array<{ web_app?: { url: string } }>> };
    };
    expect(fallbackBody.reply_markup.inline_keyboard.flat()[0]?.web_app?.url).toBe(
      "https://pokedex.example.test",
    );
  });

  it("propagates a retryable error when both welcome delivery methods fail", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: false, error_code: 503 }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWelcomeMessage(42)).rejects.toMatchObject({
      code: "TELEGRAM_API_ERROR",
      status: 502,
      expose: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not expose Telegram descriptions or the bot token in API errors", async () => {
    const token = String(process.env.TELEGRAM_BOT_TOKEN);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error_code: 401,
            description: `Unauthorized token ${token}`,
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const error = await telegramRequest("sendMessage", { chat_id: 42, text: "test" }).catch(
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({
      code: "TELEGRAM_API_ERROR",
      status: 502,
      details: { method: "sendMessage", status: 401, errorCode: 401 },
    });
    expect(JSON.stringify(error)).not.toContain(token);
  });
});
