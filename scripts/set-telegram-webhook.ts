import { config } from "dotenv";

config({ path: ".env.local" });
config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

if (!botToken || !webhookSecret || !appUrl) {
  throw new Error(
    "TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et NEXT_PUBLIC_APP_URL sont requis.",
  );
}

if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
  throw new Error("TELEGRAM_WEBHOOK_SECRET contient des caractères refusés par Telegram.");
}

if (!appUrl.startsWith("https://") && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_APP_URL doit utiliser HTTPS en production.");
}

const apiUrl = `https://api.telegram.org/bot${botToken}`;

async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${apiUrl}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { ok: boolean; description?: string };
  if (!response.ok || !result.ok) {
    throw new Error(`Telegram ${method}: ${result.description ?? response.statusText}`);
  }
}

await telegram("setWebhook", {
  url: `${appUrl}/api/telegram/webhook`,
  secret_token: webhookSecret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: false,
});

await telegram("setMyCommands", {
  commands: [
    { command: "start", description: "Accueil du Pokédex" },
    { command: "app", description: "Ouvrir la Mini App" },
    { command: "search", description: "Scanner le catalogue" },
    { command: "latest", description: "Dernières captures" },
    { command: "ranking", description: "Classements" },
    { command: "profile", description: "Mon profil" },
    { command: "partners", description: "Nos partenaires" },
    { command: "help", description: "Aide" },
    { command: "admin", description: "Administration (autorisés)" },
  ],
});

await telegram("setChatMenuButton", {
  menu_button: {
    type: "web_app",
    text: "Ouvrir le Pokédex",
    web_app: { url: appUrl },
  },
});

console.log(`Webhook Telegram configuré sur ${appUrl}/api/telegram/webhook`);
