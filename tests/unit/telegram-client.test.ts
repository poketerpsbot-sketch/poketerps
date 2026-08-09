import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

import { sendWelcomeMessage } from "@/lib/services/telegram-client";

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
  });
});
