import { z } from "zod";

export const telegramSenderSchema = z.object({
  id: z.number().int().positive().safe(),
  is_bot: z.boolean().optional(),
  first_name: z.string().trim().min(1).max(128),
  last_name: z.string().trim().max(128).optional(),
  username: z.string().trim().max(64).optional(),
  language_code: z.string().trim().max(16).optional(),
});

const chatSchema = z.object({
  id: z.number().int().safe(),
  type: z.enum(["private", "group", "supergroup", "channel"]),
});

const messageSchema = z.object({
  message_id: z.number().int().positive(),
  from: telegramSenderSchema.optional(),
  chat: chatSchema,
  text: z.string().max(4_096).optional(),
});

const callbackQuerySchema = z.object({
  id: z.string().min(1).max(128),
  from: telegramSenderSchema,
  message: messageSchema.optional(),
  data: z.string().min(1).max(64).optional(),
});

export const telegramUpdateSchema = z
  .object({
    update_id: z.number().int().nonnegative().safe(),
    message: messageSchema.optional(),
    callback_query: callbackQuerySchema.optional(),
  })
  .refine((value) => Boolean(value.message || value.callback_query), {
    message: "Mise à jour Telegram non prise en charge.",
  });

export type TelegramSender = z.infer<typeof telegramSenderSchema>;
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
