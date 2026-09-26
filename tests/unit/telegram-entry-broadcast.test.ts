import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  classifyTelegramDeliveryError,
  formatEntryPublishedTelegramPreview,
} from "@/lib/services/telegram-entry-broadcasts";

describe("published entry Telegram preview", () => {
  const payload = {
    entryId: "entry-1",
    entryUrl: "https://poketerps.example/fiches/hash-rosin",
    title: "BubbleHash <Superboof>",
    category: "Hash · Hash Rosin",
    description: "Une courte description de découverte.",
    author: "@dresseur",
    imageUrl: "https://storage.example/entry-images/photo.webp",
  } as const;

  it("keeps the message short and escapes user content", () => {
    const preview = formatEntryPublishedTelegramPreview(payload);

    expect(preview.text).toContain("🆕 Nouvelle fiche Poketerps");
    expect(preview.text).toContain("BubbleHash &lt;Superboof&gt;");
    expect(preview.text).toContain("Hash · Hash Rosin");
    expect(preview.text).toContain("Par @dresseur");
    expect(preview.text).not.toContain("imageUrl");
    expect(preview.text.length).toBeLessThan(1_024);
  });

  it("opens the exact published fiche in the Mini App", () => {
    const preview = formatEntryPublishedTelegramPreview({ ...payload, imageUrl: null });

    expect(preview.replyMarkup.inline_keyboard[0]?.[0]).toEqual({
      text: "Voir la fiche complète",
      web_app: { url: payload.entryUrl },
    });
  });

  it("isolates blocked chats and retries transient Telegram errors", () => {
    const blocked = classifyTelegramDeliveryError(
      new AppError("TELEGRAM_API_ERROR", "Telegram", 502, {
        details: { errorCode: 403, description: "Forbidden: bot was blocked by the user" },
      }),
    );
    const transient = classifyTelegramDeliveryError(
      new AppError("TELEGRAM_API_ERROR", "Telegram", 502, {
        details: { errorCode: 429, description: "Too Many Requests" },
      }),
    );

    expect(blocked).toMatchObject({ blocked: true, retryable: false });
    expect(transient).toMatchObject({ blocked: false, retryable: true });
  });
});
