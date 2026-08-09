import { beforeEach, describe, expect, it, vi } from "vitest";

const telegram = vi.hoisted(() => ({
  answerTelegramCallback: vi.fn(),
  notifyTelegramAdmins: vi.fn(),
  sendTelegramMessage: vi.fn(),
  sendWelcomeMessage: vi.fn(),
}));

vi.mock("@/lib/services/admin", () => ({
  listAdminEntries: vi.fn(),
  listAdminReviews: vi.fn(),
}));
vi.mock("@/lib/services/catalogue", () => ({ searchCatalogue: vi.fn() }));
vi.mock("@/lib/services/entries", () => ({ moderateEntry: vi.fn() }));
vi.mock("@/lib/services/messages", () => ({
  listAdminMessages: vi.fn(),
  updateAdminMessage: vi.fn(),
}));
vi.mock("@/lib/services/partners", () => ({ listPartners: vi.fn() }));
vi.mock("@/lib/services/profiles", () => ({ getMyProfile: vi.fn() }));
vi.mock("@/lib/services/rankings", () => ({ getTrainerRankings: vi.fn() }));
vi.mock("@/lib/services/reviews", () => ({ moderateReview: vi.fn() }));
vi.mock("@/lib/services/telegram-client", () => ({
  ...telegram,
  escapeTelegramHtml: (value: string) => value,
}));

import type { CurrentUser } from "@/lib/auth/current-user";
import { processTelegramUpdate } from "@/lib/services/bot";
import type { TelegramUpdate } from "@/lib/validation/telegram";

const sender = {
  id: 42,
  is_bot: false,
  first_name: "Ada",
  username: "ada",
};

const admin: CurrentUser = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  telegramId: 42,
  username: "ada",
  displayName: "Ada Admin",
  publicSlug: "ada-admin",
  profilePhotoUrl: null,
  role: "ADMIN",
};

function commandUpdate(text: string): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: sender,
      chat: { id: 42, type: "private" },
      text,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Telegram command routing", () => {
  it("routes /start through the photo welcome workflow", async () => {
    await processTelegramUpdate(commandUpdate("/start"), admin);

    expect(telegram.sendWelcomeMessage).toHaveBeenCalledWith(42);
    expect(telegram.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("returns the documented command list for /help", async () => {
    await processTelegramUpdate(commandUpdate("/help"), admin);

    expect(telegram.sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, keyboard] = telegram.sendTelegramMessage.mock.calls[0] as [
      number,
      string,
      { inline_keyboard: Array<Array<{ web_app?: { url: string } }>> },
    ];
    expect(chatId).toBe(42);
    for (const command of [
      "/start",
      "/app",
      "/search nom",
      "/latest",
      "/ranking",
      "/profile",
      "/partners",
      "/help",
      "/admin",
    ]) {
      expect(text).toContain(`<code>${command}</code>`);
    }
    expect(keyboard.inline_keyboard.flat()[0]?.web_app?.url).toBe("https://pokedex.example.test");
  });

  it("returns the complete admin keyboard for /admin", async () => {
    await processTelegramUpdate(commandUpdate("/admin"), admin);

    const [, heading, keyboard] = telegram.sendTelegramMessage.mock.calls[0] as [
      number,
      string,
      {
        inline_keyboard: Array<
          Array<{ text: string; callback_data?: string; web_app?: { url: string } }>
        >;
      },
    ];
    const buttons = keyboard.inline_keyboard.flat();
    expect(heading).toBe("<b>Administration</b>");
    expect(buttons).toHaveLength(20);
    expect(
      buttons
        .filter(({ callback_data }) => callback_data)
        .map(({ callback_data }) => callback_data),
    ).toEqual(["menu:entries", "menu:reviews", "menu:messages"]);
  });

  it("keeps /admin protected for non-team members", async () => {
    await expect(
      processTelegramUpdate(commandUpdate("/admin"), { ...admin, role: "MEMBER" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(telegram.sendTelegramMessage).not.toHaveBeenCalled();
  });
});

describe("Telegram confirmation routing", () => {
  it("turns a moderation request callback into a separate confirmation step", async () => {
    const entryId = "550e8400-e29b-41d4-a716-446655440000";
    const update: TelegramUpdate = {
      update_id: 2,
      callback_query: {
        id: "callback-1",
        from: sender,
        message: {
          message_id: 2,
          chat: { id: 42, type: "private" },
        },
        data: `do:entry:approve:${entryId}`,
      },
    };

    await processTelegramUpdate(update, admin);

    expect(telegram.answerTelegramCallback).toHaveBeenCalledWith(
      "callback-1",
      "Confirmation requise.",
    );
    const [, text, keyboard] = telegram.sendTelegramMessage.mock.calls[0] as [
      number,
      string,
      { inline_keyboard: Array<Array<{ callback_data: string }>> },
    ];
    expect(text).toContain("Confirmer");
    expect(keyboard.inline_keyboard[0]?.[0]?.callback_data).toBe(`ok:entry:approve:${entryId}`);
    expect(keyboard.inline_keyboard[0]?.[1]?.callback_data).toBe("menu:admin");
  });
});
