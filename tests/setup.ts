import { vi } from "vitest";

vi.mock("server-only", () => ({}));

Object.assign(process.env, {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "https://pokedex.example.test",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-abcdefghijklmnopqrstuvwxyz",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-abcdefghijklmnopqrstuvwxyz",
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/pokedex",
  TELEGRAM_BOT_TOKEN: "123456:abcdefghijklmnopqrstuvwxyzABCDEFGH",
  TELEGRAM_BOT_USERNAME: "pokedex_test_bot",
  TELEGRAM_WEBHOOK_SECRET: "test_webhook-secret_123456",
  TELEGRAM_OWNER_IDS: "6675436692",
  TELEGRAM_ADMIN_IDS: "1002",
  TELEGRAM_MODERATOR_IDS: "1003",
  SESSION_SECRET: "session-secret-at-least-thirty-two-characters",
  RATE_LIMIT_SECRET: "rate-limit-secret-at-least-thirty-two-chars",
  TELEGRAM_AUTH_MAX_AGE_SECONDS: "300",
  SESSION_MAX_AGE_SECONDS: "604800",
});
