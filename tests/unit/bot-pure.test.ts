import { describe, expect, it } from "vitest";

import {
  botCommandHelp,
  buildAdminMenu,
  buildHelpMessage,
  buildModeratorMenu,
  buildWelcomeMenu,
  confirmationCallback,
  isAdminActionAllowed,
  isStartCommandUpdate,
  parseBotCallback,
  parseBotCommand,
  telegramCommandsForRole,
  telegramRoleBadge,
} from "@/lib/services/bot-pure";

const id = "550e8400-e29b-41d4-a716-446655440000";

describe("bot command parsing", () => {
  it("parses arguments and bot-qualified commands", () => {
    expect(parseBotCommand("/search   pollen sec")).toEqual({
      name: "search",
      argument: "pollen sec",
    });
    expect(parseBotCommand("/latest@pokedex_test_bot", "pokedex_test_bot")).toEqual({
      name: "latest",
      argument: "",
    });
    expect(parseBotCommand("  /HELP  ")).toEqual({ name: "help", argument: "" });
  });

  it("ignores unknown commands and commands addressed to another bot", () => {
    expect(parseBotCommand("/delete_everything")).toBeNull();
    expect(parseBotCommand("/start@other_bot", "pokedex_test_bot")).toBeNull();
    expect(parseBotCommand("search pollen")).toBeNull();
    expect(parseBotCommand("/search@pokedex-test-bot pollen", "pokedex_test_bot")).toBeNull();
  });

  it("bounds user-provided search arguments", () => {
    const argument = "a".repeat(200);
    expect(parseBotCommand(`/search ${argument}`)?.argument).toHaveLength(120);
  });

  it("recognizes private /start webhook updates including bot-qualified payloads", () => {
    expect(
      isStartCommandUpdate(
        { message: { text: "/start campaign", chat: { type: "private" } } },
        "pokedex_test_bot",
      ),
    ).toBe(true);
    expect(
      isStartCommandUpdate(
        { message: { text: "/start@pokedex_test_bot ref", chat: { type: "private" } } },
        "pokedex_test_bot",
      ),
    ).toBe(true);
    expect(
      isStartCommandUpdate(
        { message: { text: "/start@other_bot", chat: { type: "private" } } },
        "pokedex_test_bot",
      ),
    ).toBe(false);
    expect(isStartCommandUpdate({ message: { text: "/start", chat: { type: "group" } } })).toBe(
      false,
    );
  });

  it("documents every supported command exactly once", () => {
    expect(botCommandHelp.map(({ name }) => name)).toEqual([
      "start",
      "app",
      "search",
      "latest",
      "ranking",
      "contest",
      "profile",
      "partners",
      "help",
      "admin",
    ]);
    const memberMessage = buildHelpMessage();
    const adminMessage = buildHelpMessage("ADMIN");
    for (const { name, usage, description } of botCommandHelp) {
      if (name !== "admin")
        expect(memberMessage).toContain(`<code>${usage}</code> — ${description}`);
      expect(adminMessage).toContain(`<code>${usage}</code> — ${description}`);
    }
    expect(memberMessage).not.toContain("<code>/admin</code>");
    expect(telegramCommandsForRole("MEMBER").some(({ command }) => command === "admin")).toBe(
      false,
    );
    expect(telegramCommandsForRole("MODERATOR").at(-1)).toEqual({
      command: "admin",
      description: "Modération (équipe autorisée)",
    });
    expect(telegramRoleBadge("OWNER")).toBe("👑 Propriétaire");
  });
});

describe("bot callback parsing", () => {
  it("requires the two-stage request/confirmation flow", () => {
    expect(parseBotCallback(`do:entry:approve:${id}`)).toEqual({
      kind: "request",
      entity: "entry",
      action: "approve",
      id,
    });
    expect(parseBotCallback(confirmationCallback("entry", "approve", id))).toEqual({
      kind: "confirm",
      entity: "entry",
      action: "approve",
      id,
    });
  });

  it("rejects malformed, oversized or non-UUID callbacks", () => {
    expect(parseBotCallback("ok:entry:approve:not-an-id")).toBeNull();
    expect(parseBotCallback("x".repeat(65))).toBeNull();
    expect(parseBotCallback(`do:entry:archive:${id}`)).toBeNull();
    expect(parseBotCallback(`do:message:approve:${id}`)).toBeNull();
    expect(parseBotCallback("menu:entries:extra")).toBeNull();
  });

  it("only generates valid entity/action confirmations", () => {
    expect(isAdminActionAllowed("review", "hide")).toBe(true);
    expect(isAdminActionAllowed("entry", "hide")).toBe(false);
    expect(() => confirmationCallback("entry", "hide", id)).toThrow(
      "Invalid Telegram confirmation callback",
    );
    expect(() => confirmationCallback("review", "hide", "not-an-id")).toThrow(
      "Invalid Telegram confirmation callback",
    );
  });
});

describe("bot menus", () => {
  it("exposes the complete admin panel while preserving native moderation callbacks", () => {
    const menu = buildAdminMenu("https://pokedex.example.test/");
    const buttons = menu.inline_keyboard.flat();
    const callbackButtons = buttons.filter(({ callback_data }) => callback_data);
    const webAppButtons = buttons.filter(({ web_app }) => web_app);

    expect(buttons).toHaveLength(22);
    expect(new Set(buttons.map(({ text }) => text))).toHaveLength(22);
    expect(callbackButtons).toEqual([
      { text: "✅ Fiches à valider", callback_data: "menu:entries" },
      { text: "💬 Avis à valider", callback_data: "menu:reviews" },
      { text: "📨 Messages", callback_data: "menu:messages" },
    ]);
    expect(webAppButtons).toHaveLength(19);
    expect(
      webAppButtons.every(({ web_app }) =>
        web_app?.url.startsWith("https://pokedex.example.test/"),
      ),
    ).toBe(true);
    expect(buttons).toContainEqual({
      text: "🛡 Ouvrir la console web",
      web_app: { url: "https://pokedex.example.test/admin" },
    });
    expect(buttons).toContainEqual({
      text: "➕ Ajouter une fiche",
      web_app: { url: "https://pokedex.example.test/capturer?mode=admin" },
    });
    expect(buttons).toContainEqual({
      text: "🚩 Signalements",
      web_app: { url: "https://pokedex.example.test/admin/messages?type=REPORT" },
    });
    expect(buttons).toContainEqual({
      text: "⚙️ Paramètres",
      web_app: { url: "https://pokedex.example.test/admin/parametres" },
    });
    expect(buttons).toContainEqual({
      text: "🎯 Gérer les concours",
      web_app: { url: "https://pokedex.example.test/admin/concours" },
    });
  });

  it("exposes a separate moderator menu without privileged administration links", () => {
    const buttons = buildModeratorMenu("https://pokedex.example.test/").inline_keyboard.flat();

    expect(buttons[0]).toEqual({
      text: "🔎 Modération Mini App",
      web_app: { url: "https://pokedex.example.test/admin/moderation" },
    });
    expect(
      buttons
        .filter(({ callback_data }) => callback_data)
        .map(({ callback_data }) => callback_data),
    ).toEqual(["menu:entries", "menu:reviews", "menu:messages"]);
    expect(JSON.stringify(buttons)).not.toMatch(/parametres|utilisateurs|badges|categories/i);
  });

  it("adds exact pending counters to the team menu without changing callbacks", () => {
    const buttons = buildModeratorMenu("https://pokedex.example.test/", {
      pendingEntries: 2,
      pendingCorrections: 1,
      pendingReviews: 4,
      pendingMessages: 5,
      pendingReports: 2,
      pendingContestParticipations: 3,
      totalActionable: 17,
    }).inline_keyboard.flat();

    expect(buttons.map(({ text }) => text)).toEqual(
      expect.arrayContaining([
        "✅ Fiches à valider · 3",
        "💬 Avis à valider · 4",
        "📨 Messages · 5",
        "🚩 Signalements · 2",
        "🎯 Concours · 3",
      ]),
    );
    expect(buttons.find(({ text }) => text.includes("Fiches"))?.callback_data).toBe("menu:entries");
  });

  it("builds the complete /start menu from configured community links", () => {
    const menu = buildWelcomeMenu({
      appUrl: "https://pokedex.example.test/",
      channelUrl: "https://t.me/pokedex_channel",
      chatUrl: "https://t.me/pokedex_chat",
      instagramUrl: "https://instagram.com/pokedex",
    });
    const buttons = menu.inline_keyboard.flat();

    expect(buttons.map(({ text }) => text)).toEqual([
      "📱 Ouvrir le Pokédex",
      "📢 Suivre le canal",
      "💬 Rejoindre le chat",
      "📸 Instagram",
      "🏆 Classements",
      "🎯 Concours",
      "🤝 Nos partenaires",
      "👤 Mon profil",
      "ℹ️ À propos",
    ]);
    expect(buttons).toContainEqual({
      text: "🏆 Classements",
      callback_data: "menu:ranking",
    });
    expect(buttons).toContainEqual({
      text: "👤 Mon profil",
      web_app: { url: "https://pokedex.example.test/profil" },
    });
    expect(JSON.stringify(menu)).not.toMatch(/mentions? l[ée]gales?/i);
  });

  it("adds the team entry only to role-aware welcome menus", () => {
    const memberButtons = buildWelcomeMenu(
      { appUrl: "https://pokedex.example.test" },
      "MEMBER",
    ).inline_keyboard.flat();
    const adminButtons = buildWelcomeMenu(
      { appUrl: "https://pokedex.example.test" },
      "ADMIN",
    ).inline_keyboard.flat();
    const moderatorButtons = buildWelcomeMenu(
      { appUrl: "https://pokedex.example.test" },
      "MODERATOR",
    ).inline_keyboard.flat();

    expect(memberButtons.some(({ callback_data }) => callback_data === "menu:admin")).toBe(false);
    expect(adminButtons).toContainEqual({ text: "🛡 Administration", callback_data: "menu:admin" });
    expect(moderatorButtons).toContainEqual({ text: "🔎 Modération", callback_data: "menu:admin" });
  });

  it("omits unconfigured external links without producing empty rows", () => {
    const menu = buildWelcomeMenu({ appUrl: "https://pokedex.example.test" });
    const buttons = menu.inline_keyboard.flat();

    expect(menu.inline_keyboard.every((row) => row.length > 0)).toBe(true);
    expect(buttons).toHaveLength(6);
    expect(buttons.some(({ url }) => url)).toBe(false);
  });
});
