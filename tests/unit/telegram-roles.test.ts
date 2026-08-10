import { describe, expect, it } from "vitest";

import { getEnv } from "@/lib/env";
import { roleForTelegramId } from "@/lib/services/auth";

describe("Telegram bootstrap roles", () => {
  it("parses moderator IDs from the environment", () => {
    expect(getEnv().TELEGRAM_MODERATOR_IDS).toEqual([1003]);
  });

  it("resolves owner, administrator and moderator IDs with explicit precedence", () => {
    expect(roleForTelegramId(6_675_436_692)).toBe("OWNER");
    expect(roleForTelegramId(1002)).toBe("ADMIN");
    expect(roleForTelegramId(1003)).toBe("MODERATOR");
    expect(roleForTelegramId(1004)).toBe("MEMBER");
  });
});
