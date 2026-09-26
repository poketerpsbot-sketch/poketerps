import "server-only";

import { isAdminRole } from "@/lib/auth/rbac";
import type { CurrentUser } from "@/lib/auth/current-user";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { roleForTelegramId } from "@/lib/services/auth";
import { listAdminEntries, listAdminReviews } from "@/lib/services/admin";
import { getAdminQueueCounts, type AdminQueueCounts } from "@/lib/services/admin-queues";
import {
  buildHelpMessage,
  buildTeamMenu,
  parseBotCallback,
  parseBotCommand,
  telegramRoleBadge,
  type AdminEntity,
} from "@/lib/services/bot-pure";
import { searchCatalogue } from "@/lib/services/catalogue";
import { listAdminMessages } from "@/lib/services/messages";
import { listPartners } from "@/lib/services/partners";
import { getMyProfile } from "@/lib/services/profiles";
import { getTrainerRankings } from "@/lib/services/rankings";
import {
  answerTelegramCallback,
  escapeTelegramHtml,
  notifyTelegramAdmins,
  sendTelegramMessage,
  sendWelcomeMessage,
  type InlineKeyboardMarkup,
} from "@/lib/services/telegram-client";
import type { TelegramUpdate } from "@/lib/validation/telegram";

function adminMenu(actor: CurrentUser, counts?: AdminQueueCounts): InlineKeyboardMarkup {
  return buildTeamMenu(getEnv().NEXT_PUBLIC_APP_URL, actor.role, counts);
}

async function queueAwareAdminMenu(actor: CurrentUser): Promise<{
  heading: string;
  keyboard: InlineKeyboardMarkup;
}> {
  try {
    const counts = await getAdminQueueCounts(actor);
    return { heading: teamHeading(actor, counts), keyboard: adminMenu(actor, counts) };
  } catch {
    return { heading: teamHeading(actor), keyboard: adminMenu(actor) };
  }
}

function teamHeading(actor: CurrentUser, counts?: AdminQueueCounts): string {
  const title = actor.role === "MODERATOR" ? "Modération" : "Administration complète";
  const queueSummary = counts
    ? `\n\n<b>${counts.totalActionable} élément${counts.totalActionable > 1 ? "s" : ""} à traiter</b> · Fiches ${counts.pendingEntries + counts.pendingCorrections} · Avis ${counts.pendingReviews} · Messages ${counts.pendingMessages + counts.pendingReports} · Concours ${counts.pendingContestParticipations}`
    : "";
  return `<b>${title}</b>\n${escapeTelegramHtml(actor.displayName)} · ${telegramRoleBadge(actor.role)}${queueSummary}\n\nChoisis une action correspondant à tes autorisations.`;
}

function moderationQueueKeyboard(entity: AdminEntity, id: string): InlineKeyboardMarkup {
  const paths: Record<AdminEntity, string> = {
    entry: `/admin/fiches?entry=${encodeURIComponent(id)}`,
    review: `/admin/avis?review=${encodeURIComponent(id)}`,
    message: `/admin/messages?message=${encodeURIComponent(id)}`,
  };
  return {
    inline_keyboard: [
      [
        {
          text: "Ouvrir Pokédex",
          web_app: { url: `${getEnv().NEXT_PUBLIC_APP_URL}${paths[entity]}` },
        },
      ],
    ],
  };
}

function appKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Ouvrir le Pokédex", web_app: { url: getEnv().NEXT_PUBLIC_APP_URL } }],
    ],
  };
}

async function sendLatest(chatId: number): Promise<void> {
  const result = await searchCatalogue({ limit: 5, offset: 0, sort: "recent" });
  if (result.entries.length === 0) {
    await sendTelegramMessage(chatId, "Aucune fiche publiée pour le moment.", appKeyboard());
    return;
  }
  const lines = result.entries.map(
    (entry) =>
      `• <a href="${getEnv().NEXT_PUBLIC_APP_URL}/fiches/${encodeURIComponent(entry.slug)}">${escapeTelegramHtml(entry.name)}</a>`,
  );
  await sendTelegramMessage(
    chatId,
    `<b>Dernières fiches</b>\n\n${lines.join("\n")}`,
    appKeyboard(),
  );
}

async function sendSearch(chatId: number, argument: string): Promise<void> {
  if (!argument) {
    await sendTelegramMessage(
      chatId,
      "Utilise <code>/search nom</code> ou ouvre le catalogue.",
      appKeyboard(),
    );
    return;
  }
  const result = await searchCatalogue({ limit: 5, offset: 0, sort: "recent", query: argument });
  if (result.entries.length === 0) {
    await sendTelegramMessage(
      chatId,
      `Aucun résultat pour <b>${escapeTelegramHtml(argument)}</b>.`,
      appKeyboard(),
    );
    return;
  }
  const lines = result.entries.map(
    (entry) =>
      `• <a href="${getEnv().NEXT_PUBLIC_APP_URL}/fiches/${encodeURIComponent(entry.slug)}">${escapeTelegramHtml(entry.name)}</a>`,
  );
  await sendTelegramMessage(chatId, `<b>Résultats</b>\n\n${lines.join("\n")}`, appKeyboard());
}

async function sendRanking(chatId: number): Promise<void> {
  const rankings = await getTrainerRankings("week", 5, 0);
  const body = rankings.length
    ? rankings
        .map(
          (item) =>
            `${item.rank}. ${escapeTelegramHtml(item.displayName)} — ${item.periodCaptures}`,
        )
        .join("\n")
    : "Le classement est encore vide.";
  await sendTelegramMessage(chatId, `<b>Classement de la semaine</b>\n\n${body}`, appKeyboard());
}

async function sendPartners(chatId: number): Promise<void> {
  const result = await listPartners({ limit: 8, offset: 0, includeInactive: false });
  const body = result.partners.length
    ? result.partners.map((partner) => `• ${escapeTelegramHtml(partner.name)}`).join("\n")
    : "Aucun partenaire actif.";
  await sendTelegramMessage(chatId, `<b>Partenaires</b>\n\n${body}`, {
    inline_keyboard: [
      [
        {
          text: "Voir les partenaires",
          web_app: { url: `${getEnv().NEXT_PUBLIC_APP_URL}/partenaires` },
        },
      ],
    ],
  });
}

async function sendContest(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    "<b>🎯 Concours communautaires</b>\n\nDécouvre les concours en cours, leurs règles, les dates importantes et les participations de la communauté.",
    {
      inline_keyboard: [
        [
          {
            text: "Voir les concours",
            web_app: { url: `${getEnv().NEXT_PUBLIC_APP_URL}/concours` },
          },
        ],
      ],
    },
  );
}

async function sendProfile(chatId: number, actor: CurrentUser): Promise<void> {
  const profile = await getMyProfile(actor);
  const total = Object.values(profile.counts.entries).reduce(
    (sum, value) => sum + Number(value),
    0,
  );
  await sendTelegramMessage(
    chatId,
    `<b>${escapeTelegramHtml(actor.displayName)}</b> · ${telegramRoleBadge(actor.role)}\nNiveau ${profile.level ?? 1} · ${total} fiche(s)`,
    {
      inline_keyboard: [
        [{ text: "Mon profil", web_app: { url: `${getEnv().NEXT_PUBLIC_APP_URL}/profil` } }],
      ],
    },
  );
}

async function sendAdminEntries(chatId: number, actor: CurrentUser): Promise<void> {
  const result = await listAdminEntries({ status: "PENDING_REVIEW", limit: 5, offset: 0 });
  if (!result.entries.length) {
    await sendTelegramMessage(chatId, "Aucune fiche en attente.", adminMenu(actor));
    return;
  }
  for (const entry of result.entries) {
    await sendTelegramMessage(
      chatId,
      `<b>Fiche à valider</b>\n${escapeTelegramHtml(entry.name)}\nPar ${escapeTelegramHtml(entry.author.displayName)}`,
      moderationQueueKeyboard("entry", entry.id),
    );
  }
}

async function sendAdminReviews(chatId: number, actor: CurrentUser): Promise<void> {
  const result = await listAdminReviews({ status: "PENDING_REVIEW", limit: 5, offset: 0 });
  if (!result.reviews.length) {
    await sendTelegramMessage(chatId, "Aucun avis en attente.", adminMenu(actor));
    return;
  }
  for (const review of result.reviews) {
    await sendTelegramMessage(
      chatId,
      `<b>Avis à valider</b>\n${escapeTelegramHtml(review.entryName)} · ${review.overallRating}/10\n\n${escapeTelegramHtml(review.content.slice(0, 700))}`,
      moderationQueueKeyboard("review", review.id),
    );
  }
}

async function sendAdminMessages(chatId: number, actor: CurrentUser): Promise<void> {
  const result = await listAdminMessages({ limit: 5, offset: 0 });
  const messages = result.messages.filter((message) =>
    ["NEW", "READ", "IN_PROGRESS"].includes(message.status),
  );
  if (!messages.length) {
    await sendTelegramMessage(chatId, "Aucun message ouvert.", adminMenu(actor));
    return;
  }
  for (const message of messages) {
    await sendTelegramMessage(
      chatId,
      `<b>${escapeTelegramHtml(message.subject)}</b>\n${escapeTelegramHtml(message.content.slice(0, 700))}`,
      moderationQueueKeyboard("message", message.id),
    );
  }
}

function assertBotAdmin(actor: CurrentUser): void {
  if (!isAdminRole(actor.role))
    throw new AppError("FORBIDDEN", "Commande réservée à l’équipe.", 403);
}

async function handleCallback(update: TelegramUpdate, actor: CurrentUser): Promise<void> {
  const callback = update.callback_query;
  if (!callback?.data) return;
  const parsed = parseBotCallback(callback.data);
  if (!parsed) {
    await answerTelegramCallback(callback.id, "Action invalide ou expirée.", true);
    return;
  }
  const chatId = callback.message?.chat.id ?? actor.telegramId;
  if (chatId === null)
    throw new AppError("INVALID_TELEGRAM_USER", "Utilisateur Telegram invalide.", 401);
  if (parsed.kind === "menu") {
    if (parsed.value === "latest") await sendLatest(chatId);
    else if (parsed.value === "ranking") await sendRanking(chatId);
    else {
      assertBotAdmin(actor);
      if (parsed.value === "admin") {
        const menu = await queueAwareAdminMenu(actor);
        await sendTelegramMessage(chatId, menu.heading, menu.keyboard);
      }
      if (parsed.value === "entries") {
        await sendAdminEntries(chatId, actor);
      }
      if (parsed.value === "reviews") {
        await sendAdminReviews(chatId, actor);
      }
      if (parsed.value === "messages") {
        await sendAdminMessages(chatId, actor);
      }
    }
    await answerTelegramCallback(callback.id);
    return;
  }
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  actor: CurrentUser | null,
): Promise<void> {
  if (update.callback_query) {
    if (!actor) {
      throw new AppError("INVALID_TELEGRAM_USER", "Utilisateur Telegram invalide.", 401);
    }
    await handleCallback(update, actor);
    return;
  }
  const message = update.message;
  if (!message?.from || message.chat.type !== "private") return;
  const command = message.text
    ? parseBotCommand(message.text, getEnv().TELEGRAM_BOT_USERNAME)
    : null;
  if (!command) {
    await sendTelegramMessage(
      message.chat.id,
      "Utilise /help pour afficher les commandes.",
      appKeyboard(),
    );
    return;
  }
  if (command.name === "start") {
    const displayName =
      actor?.displayName ??
      [message.from.first_name, message.from.last_name].filter(Boolean).join(" ").slice(0, 120);
    await sendWelcomeMessage(message.chat.id, {
      displayName,
      username: actor?.username ?? message.from.username ?? null,
      role: actor?.role ?? roleForTelegramId(message.from.id),
    });
  } else if (!actor) {
    throw new AppError("INVALID_TELEGRAM_USER", "Utilisateur Telegram invalide.", 401);
  } else if (command.name === "app")
    await sendTelegramMessage(
      message.chat.id,
      `<b>${escapeTelegramHtml(actor.displayName)}</b> · ${telegramRoleBadge(actor.role)}\n\nOuvre la Mini App :`,
      appKeyboard(),
    );
  else if (command.name === "search") await sendSearch(message.chat.id, command.argument);
  else if (command.name === "latest") await sendLatest(message.chat.id);
  else if (command.name === "ranking") await sendRanking(message.chat.id);
  else if (command.name === "contest") await sendContest(message.chat.id);
  else if (command.name === "profile") await sendProfile(message.chat.id, actor);
  else if (command.name === "partners") await sendPartners(message.chat.id);
  else if (command.name === "admin") {
    assertBotAdmin(actor);
    const menu = await queueAwareAdminMenu(actor);
    await sendTelegramMessage(message.chat.id, menu.heading, menu.keyboard);
  } else if (command.name === "help") {
    await sendTelegramMessage(message.chat.id, buildHelpMessage(actor.role), appKeyboard());
  }
}

export async function notifyModerationQueue(
  entity: AdminEntity,
  id: string,
  title: string,
): Promise<void> {
  const labels = {
    entry: "NOUVELLE FICHE À VALIDER",
    review: "NOUVEL AVIS À VALIDER",
    message: "NOUVEAU MESSAGE À TRAITER",
  };
  await notifyTelegramAdmins(
    `<b>${labels[entity]}</b>\nUne nouvelle activité a été envoyée sur Pokédex.\n${escapeTelegramHtml(title)}\n\nOuvre l’administration pour la consulter.`,
    moderationQueueKeyboard(entity, id),
  );
}
