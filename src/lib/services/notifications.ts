import "server-only";

import { getSqlClient } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  type InlineKeyboardMarkup,
} from "@/lib/services/telegram-client";

export type UserNotificationType =
  | "REVIEW_APPROVED"
  | "REVIEW_REJECTED"
  | "REVIEW_CHANGES_REQUESTED"
  | "REVIEW_RESUBMITTED"
  | "ENTRY_APPROVED"
  | "ENTRY_REJECTED"
  | "ENTRY_CHANGES_REQUESTED"
  | "CONTEST"
  | "SYSTEM";

export type NotificationInput = {
  userId: string;
  type: UserNotificationType;
  title: string;
  message: string;
  relatedReviewId?: string | null;
  relatedEntryId?: string | null;
  relatedContestId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createUserNotification(input: NotificationInput) {
  const [notification] = await getSqlClient()<Array<{ id: string; created_at: Date }>>`
    insert into user_notifications (
      user_id, type, title, message, related_review_id, related_entry_id, related_contest_id,
      action_url, metadata
    ) values (
      ${input.userId}::uuid,
      ${input.type},
      ${input.title},
      ${input.message},
      ${input.relatedReviewId ?? null}::uuid,
      ${input.relatedEntryId ?? null}::uuid,
      ${input.relatedContestId ?? null}::uuid,
      ${input.actionUrl ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    returning id, created_at
  `;
  return notification ?? null;
}

export async function listUserNotifications(
  userId: string,
  query: { limit: number; offset: number; unreadOnly?: boolean },
) {
  const unreadOnly = query.unreadOnly === true;
  const rows = await getSqlClient()<
    Array<{
      id: string;
      type: UserNotificationType;
      title: string;
      message: string;
      related_review_id: string | null;
      related_entry_id: string | null;
      related_contest_id: string | null;
      action_url: string | null;
      is_read: boolean;
      created_at: Date;
      entry_name: string | null;
      entry_slug: string | null;
      total_count: number;
      unread_count: number;
    }>
  >`
    select n.id, n.type::text, n.title, n.message, n.related_review_id,
      n.related_entry_id, n.related_contest_id, n.action_url, n.is_read, n.created_at,
      e.name entry_name, e.slug entry_slug,
      count(*) over()::int total_count,
      count(*) filter (where n.is_read=false) over()::int unread_count
    from user_notifications n
    left join entries e on e.id=n.related_entry_id
    where n.user_id=${userId}::uuid
      and (${unreadOnly}::boolean=false or n.is_read=false)
    order by n.created_at desc, n.id desc
    limit ${query.limit} offset ${query.offset}
  `;

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      relatedReviewId: row.related_review_id,
      relatedEntryId: row.related_entry_id,
      relatedContestId: row.related_contest_id,
      actionUrl: row.action_url?.startsWith("/") ? row.action_url : null,
      isRead: row.is_read,
      createdAt: row.created_at,
      entry: row.entry_name
        ? { id: row.related_entry_id, name: row.entry_name, slug: row.entry_slug }
        : null,
    })),
    total: Number(rows[0]?.total_count ?? 0),
    unreadCount: Number(rows[0]?.unread_count ?? 0),
  };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await getSqlClient()<Array<{ count: number }>>`
    select count(*)::int count
    from user_notifications
    where user_id=${userId}::uuid and is_read=false
  `;
  return Number(row?.count ?? 0);
}

export async function markUserNotificationsRead(
  userId: string,
  input: { notificationId?: string; all?: boolean },
) {
  if (input.all) {
    const rows = await getSqlClient()<Array<{ id: string }>>`
      update user_notifications
      set is_read=true, read_at=coalesce(read_at, now())
      where user_id=${userId}::uuid and is_read=false
      returning id
    `;
    return { updated: rows.length };
  }

  const rows = await getSqlClient()<Array<{ id: string }>>`
    update user_notifications
    set is_read=true, read_at=coalesce(read_at, now())
    where id=${input.notificationId ?? null}::uuid and user_id=${userId}::uuid and is_read=false
    returning id
  `;
  return { updated: rows.length };
}

export async function sendReviewStatusTelegram(input: {
  telegramId: number | null;
  text: string;
  reviewId: string;
}): Promise<boolean> {
  if (!input.telegramId) return false;
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: "Ouvrir mes avis",
          web_app: { url: `${getEnv().NEXT_PUBLIC_APP_URL}/profil/avis` },
        },
      ],
    ],
  };
  try {
    await sendTelegramMessage(input.telegramId, escapeTelegramHtml(input.text), keyboard);
    return true;
  } catch (error) {
    logger.warn("telegram_review_notification_failed", {
      reviewId: input.reviewId,
      userTelegramId: input.telegramId,
      error,
    });
    return false;
  }
}

export async function sendEntryStatusTelegram(input: {
  telegramId: number | null;
  text: string;
  entryId: string;
  actionUrl: string;
  buttonLabel: string;
}): Promise<boolean> {
  if (!input.telegramId) return false;
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: input.buttonLabel,
          web_app: { url: `${getEnv().NEXT_PUBLIC_APP_URL}${input.actionUrl}` },
        },
      ],
    ],
  };
  try {
    await sendTelegramMessage(input.telegramId, escapeTelegramHtml(input.text), keyboard);
    return true;
  } catch (error) {
    logger.warn("telegram_entry_notification_failed", {
      entryId: input.entryId,
      userTelegramId: input.telegramId,
      error,
    });
    return false;
  }
}
