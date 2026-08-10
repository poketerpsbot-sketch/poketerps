import "server-only";

import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z
    .url()
    .transform((value) => value.replace(/\/$/, ""))
    .optional(),
);

const optionalString = (schema: z.ZodString) =>
  z.preprocess(emptyStringToUndefined, schema.optional());

const commaSeparatedTelegramIds = z
  .string()
  .default("")
  .transform((value, context) => {
    if (!value.trim()) return [] as number[];

    const ids = value.split(",").map((item) => Number(item.trim()));
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      context.addIssue({
        code: "custom",
        message: "must be a comma-separated list of positive Telegram IDs",
      });
      return z.NEVER;
    }
    return [...new Set(ids)];
  });

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  NEXT_PUBLIC_APP_URL: z.url().transform((value) => value.replace(/\/$/, "")),
  SUPABASE_URL: z.url().transform((value) => value.replace(/\/$/, "")),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: optionalString(z.string().min(1)),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{20,}$/),
  TELEGRAM_BOT_USERNAME: z.string().trim().min(1).max(64),
  TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
  TELEGRAM_OWNER_IDS: commaSeparatedTelegramIds,
  TELEGRAM_ADMIN_IDS: commaSeparatedTelegramIds,
  TELEGRAM_MODERATOR_IDS: commaSeparatedTelegramIds,
  TELEGRAM_CHANNEL_ID: optionalString(z.string().trim().min(1)),
  TELEGRAM_CHANNEL_URL: optionalUrl,
  TELEGRAM_CHAT_URL: optionalUrl,
  INSTAGRAM_URL: optionalUrl,
  SESSION_SECRET: z.string().min(32),
  RATE_LIMIT_SECRET: z.string().min(32),
  APP_DISPLAY_NAME: z.string().trim().min(1).max(80).default("Pokédex"),
  APP_TIMEZONE: z.string().trim().min(1).default("Europe/Zurich"),
  APP_LEGAL_COUNTRY: z.string().trim().min(2).max(80).default("Switzerland"),
  AGE_GATE_ENABLED: booleanFromString,
  MINIMUM_AGE: z.coerce.number().int().min(0).max(25).default(18),
  ENTRY_VIEW_DEDUP_HOURS: z.coerce.number().int().min(1).max(168).default(6),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().min(30).max(3_600).default(300),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let parsedEnv: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (parsedEnv) return parsedEnv;

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }

  parsedEnv = result.data;
  return parsedEnv;
}

export function isConfigured(): boolean {
  return serverEnvSchema.safeParse(process.env).success;
}
