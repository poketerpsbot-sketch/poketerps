export type BotCommand = {
  name:
    "start" | "app" | "search" | "latest" | "ranking" | "profile" | "partners" | "help" | "admin";
  argument: string;
};

export const botCommandHelp: ReadonlyArray<{
  name: BotCommand["name"];
  usage: string;
  description: string;
}> = [
  { name: "start", usage: "/start", description: "Afficher l’accueil" },
  { name: "app", usage: "/app", description: "Ouvrir la Mini App" },
  { name: "search", usage: "/search nom", description: "Rechercher une fiche" },
  { name: "latest", usage: "/latest", description: "Voir les dernières fiches" },
  { name: "ranking", usage: "/ranking", description: "Voir le classement" },
  { name: "profile", usage: "/profile", description: "Ouvrir mon profil" },
  { name: "partners", usage: "/partners", description: "Voir les partenaires" },
  { name: "help", usage: "/help", description: "Afficher cette aide" },
  { name: "admin", usage: "/admin", description: "Ouvrir le panel équipe" },
];

const commandNames = new Set<BotCommand["name"]>(botCommandHelp.map(({ name }) => name));

export function buildHelpMessage(): string {
  const commands = botCommandHelp
    .map(({ usage, description }) => `<code>${usage}</code> — ${description}`)
    .join("\n");
  return `<b>Commandes</b>\n\n${commands}`;
}

export function parseBotCommand(text: string, botUsername?: string): BotCommand | null {
  const match = text.trim().match(/^\/([a-z]+)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const name = match[1]?.toLowerCase() as BotCommand["name"];
  const addressedBot = match[2]?.toLowerCase();
  if (!commandNames.has(name)) return null;
  if (addressedBot && botUsername && addressedBot !== botUsername.toLowerCase()) return null;
  return { name, argument: match[3]?.trim().slice(0, 120) ?? "" };
}

export function isStartCommandUpdate(
  update: { message?: { text?: string; chat: { type: string } } },
  botUsername?: string,
): boolean {
  const message = update.message;
  if (!message?.text || message.chat.type !== "private") return false;
  return parseBotCommand(message.text, botUsername)?.name === "start";
}

export type AdminEntity = "entry" | "review" | "message";
export type AdminAction =
  "approve" | "publish" | "changes" | "reject" | "hide" | "read" | "assign" | "resolve" | "archive";

export type BotCallback =
  | { kind: "menu"; value: "latest" | "ranking" | "admin" | "entries" | "reviews" | "messages" }
  | { kind: "request" | "confirm"; entity: AdminEntity; action: AdminAction; id: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const entityNames = new Set<AdminEntity>(["entry", "review", "message"]);
const actionNames = new Set<AdminAction>([
  "approve",
  "publish",
  "changes",
  "reject",
  "hide",
  "read",
  "assign",
  "resolve",
  "archive",
]);

const allowedActions: Record<AdminEntity, ReadonlySet<AdminAction>> = {
  entry: new Set(["approve", "publish", "changes", "reject"]),
  review: new Set(["approve", "publish", "changes", "reject", "hide"]),
  message: new Set(["read", "assign", "resolve", "archive"]),
};

export function isAdminActionAllowed(entity: AdminEntity, action: AdminAction): boolean {
  return allowedActions[entity].has(action);
}

export function parseBotCallback(data: string): BotCallback | null {
  if (data.length > 64) return null;
  const parts = data.split(":");
  if (parts[0] === "menu" && parts.length === 2) {
    const value = parts[1];
    if (["latest", "ranking", "admin", "entries", "reviews", "messages"].includes(value)) {
      return { kind: "menu", value: value as Extract<BotCallback, { kind: "menu" }>["value"] };
    }
    return null;
  }
  if ((parts[0] === "do" || parts[0] === "ok") && parts.length === 4) {
    const entity = parts[1] as AdminEntity;
    const action = parts[2] as AdminAction;
    const id = parts[3] ?? "";
    if (
      entityNames.has(entity) &&
      actionNames.has(action) &&
      isAdminActionAllowed(entity, action) &&
      uuidPattern.test(id)
    ) {
      return { kind: parts[0] === "do" ? "request" : "confirm", entity, action, id };
    }
  }
  return null;
}

export function confirmationCallback(entity: AdminEntity, action: AdminAction, id: string): string {
  if (!isAdminActionAllowed(entity, action) || !uuidPattern.test(id)) {
    throw new Error("Invalid Telegram confirmation callback");
  }
  return `ok:${entity}:${action}:${id}`;
}

export type PureInlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
};

export type PureInlineKeyboardMarkup = {
  inline_keyboard: PureInlineKeyboardButton[][];
};

function appUrl(baseUrl: string, path = ""): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export function buildAdminMenu(baseUrl: string): PureInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "🛡 Ouvrir la console web",
          web_app: { url: appUrl(baseUrl, "/admin") },
        },
      ],
      [
        {
          text: "➕ Ajouter une fiche",
          web_app: { url: appUrl(baseUrl, "/capturer?mode=admin") },
        },
      ],
      [
        {
          text: "✏️ Modifier une fiche",
          web_app: { url: appUrl(baseUrl, "/admin/fiches?mode=edit") },
        },
        {
          text: "🗂 Gérer les fiches",
          web_app: { url: appUrl(baseUrl, "/admin/fiches?view=all") },
        },
      ],
      [
        {
          text: "📝 Brouillons",
          web_app: { url: appUrl(baseUrl, "/admin/fiches?status=DRAFT") },
        },
        { text: "✅ Fiches à valider", callback_data: "menu:entries" },
      ],
      [
        { text: "💬 Avis à valider", callback_data: "menu:reviews" },
        { text: "📨 Messages", callback_data: "menu:messages" },
      ],
      [
        {
          text: "🚩 Signalements",
          web_app: { url: appUrl(baseUrl, "/admin/messages?type=REPORT") },
        },
        { text: "🖼 Images", web_app: { url: appUrl(baseUrl, "/admin/fiches") } },
      ],
      [
        { text: "🗃 Catégories", web_app: { url: appUrl(baseUrl, "/admin/categories") } },
        {
          text: "📢 Publications",
          web_app: { url: appUrl(baseUrl, "/admin/publications") },
        },
      ],
      [
        { text: "👤 Profils", web_app: { url: appUrl(baseUrl, "/admin/utilisateurs") } },
        {
          text: "👥 Utilisateurs",
          web_app: { url: appUrl(baseUrl, "/admin/utilisateurs") },
        },
      ],
      [
        { text: "🏅 Badges", web_app: { url: appUrl(baseUrl, "/admin/badges") } },
        {
          text: "🏆 Classements",
          web_app: { url: appUrl(baseUrl, "/classements") },
        },
      ],
      [
        {
          text: "🤝 Partenaires",
          web_app: { url: appUrl(baseUrl, "/admin/partenaires") },
        },
        { text: "🛡 Équipe", web_app: { url: appUrl(baseUrl, "/admin/utilisateurs") } },
      ],
      [
        {
          text: "📊 Statistiques",
          web_app: { url: appUrl(baseUrl, "/admin/statistiques") },
        },
        { text: "📜 Journal", web_app: { url: appUrl(baseUrl, "/admin/journal") } },
      ],
      [
        {
          text: "⚙️ Paramètres",
          web_app: { url: appUrl(baseUrl, "/admin/parametres") },
        },
      ],
    ],
  };
}

export type WelcomeLinks = {
  appUrl: string;
  channelUrl?: string;
  chatUrl?: string;
  instagramUrl?: string;
};

function rowsOfTwo(buttons: PureInlineKeyboardButton[]): PureInlineKeyboardButton[][] {
  const rows: PureInlineKeyboardButton[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}

export function buildWelcomeMenu({
  appUrl: baseUrl,
  channelUrl,
  chatUrl,
  instagramUrl,
}: WelcomeLinks): PureInlineKeyboardMarkup {
  const communityLinks: PureInlineKeyboardButton[] = [];
  if (channelUrl) communityLinks.push({ text: "📢 Suivre le canal", url: channelUrl });
  if (chatUrl) communityLinks.push({ text: "💬 Rejoindre le chat", url: chatUrl });
  if (instagramUrl) communityLinks.push({ text: "📸 Instagram", url: instagramUrl });

  return {
    inline_keyboard: [
      [{ text: "📱 Ouvrir le Pokédex", web_app: { url: appUrl(baseUrl) } }],
      ...rowsOfTwo(communityLinks),
      [
        { text: "🏆 Classements", callback_data: "menu:ranking" },
        {
          text: "🤝 Nos partenaires",
          web_app: { url: appUrl(baseUrl, "/partenaires") },
        },
      ],
      [
        { text: "👤 Mon profil", web_app: { url: appUrl(baseUrl, "/profil") } },
        { text: "ℹ️ À propos", web_app: { url: appUrl(baseUrl, "/a-propos") } },
      ],
    ],
  };
}
