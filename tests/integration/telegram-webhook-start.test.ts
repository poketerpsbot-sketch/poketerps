import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const receipts = vi.hoisted(() => ({
  claimTelegramUpdate: vi.fn(),
  completeTelegramUpdate: vi.fn(),
  failTelegramUpdate: vi.fn(),
}));
const auth = vi.hoisted(() => ({ upsertTrustedTelegramUser: vi.fn() }));
const bot = vi.hoisted(() => ({ processTelegramUpdate: vi.fn() }));
const telegram = vi.hoisted(() => ({
  answerTelegramCallback: vi.fn(),
  sendTelegramMessage: vi.fn(),
}));
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/services/telegram-updates", () => receipts);
vi.mock("@/lib/services/auth", () => auth);
vi.mock("@/lib/services/bot", () => bot);
vi.mock("@/lib/services/telegram-client", () => telegram);
vi.mock("@/lib/logger", () => ({ logger: log }));

import { POST } from "@/app/api/telegram/webhook/route";
import { AppError } from "@/lib/errors";

const startUpdate = {
  update_id: 99,
  message: {
    message_id: 7,
    from: { id: 42, is_bot: false, first_name: "Ada", username: "ada" },
    chat: { id: 42, type: "private" },
    text: "/start welcome",
  },
};

function webhookRequest() {
  return new NextRequest("https://pokedex.example.test/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": "test_webhook-secret_123456",
    },
    body: JSON.stringify(startUpdate),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  receipts.claimTelegramUpdate.mockResolvedValue(true);
  receipts.completeTelegramUpdate.mockResolvedValue(undefined);
  receipts.failTelegramUpdate.mockResolvedValue(undefined);
  bot.processTelegramUpdate.mockResolvedValue(undefined);
});

describe("POST /api/telegram/webhook /start", () => {
  it("sends the welcome without waiting for a user upsert", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { accepted: true } });
    expect(bot.processTelegramUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ update_id: 99 }),
      null,
    );
    expect(auth.upsertTrustedTelegramUser).not.toHaveBeenCalled();
    expect(receipts.completeTelegramUpdate).toHaveBeenCalledWith(99);
  });

  it("still sends the welcome if receipt storage is temporarily unavailable", async () => {
    receipts.claimTelegramUpdate.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { accepted: true, degraded: true } });
    expect(bot.processTelegramUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ update_id: 99 }),
      null,
    );
    expect(auth.upsertTrustedTelegramUser).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      "telegram_start_idempotency_unavailable",
      expect.objectContaining({ updateId: 99 }),
    );
  });

  it("returns a retryable non-2xx response when Telegram delivery fails", async () => {
    bot.processTelegramUpdate.mockRejectedValue(
      new AppError("TELEGRAM_API_ERROR", "Telegram indisponible.", 502, { expose: false }),
    );

    const response = await POST(webhookRequest());

    expect(response.status).toBe(502);
    expect(receipts.failTelegramUpdate).toHaveBeenCalledWith(99, expect.any(AppError));
    expect(receipts.completeTelegramUpdate).not.toHaveBeenCalled();
  });
});
