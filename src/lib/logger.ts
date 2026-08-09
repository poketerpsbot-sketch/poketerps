import "server-only";

const REDACTED_KEYS =
  /token|secret|password|authorization|cookie|initdata|service.?role|database.?url/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACTED_KEYS.test(key) ? "[redacted]" : sanitize(item, depth + 1),
      ]),
    );
  }
  if (typeof value === "string" && value.length > 2_000) return `${value.slice(0, 2_000)}…`;
  return value;
}

function write(
  level: "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>,
) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: sanitize(context) } : {}),
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};
