"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TelegramWebApp = {
  initData?: string;
  colorScheme?: "light" | "dark";
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function TelegramBridge() {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    document.documentElement.dataset.telegram = "true";
    webApp.ready?.();
    webApp.expand?.();
    webApp.setHeaderColor?.("#be1730");
    webApp.setBackgroundColor?.("#7f0c1d");

    if (!webApp.initData) return;
    const controller = new AbortController();
    void fetch("/api/auth/session", { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) return;
        const authResponse = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: webApp.initData }),
          signal: controller.signal,
        });
        if (!authResponse.ok) {
          const payload = (await authResponse.json().catch(() => null)) as {
            error?: { code?: string; message?: string };
            message?: string;
          } | null;
          if (payload?.error?.code === "EXPIRED_TELEGRAM_INIT_DATA") {
            throw new Error(
              "La session Telegram a expiré. Ferme cette fenêtre puis rouvre la Mini App depuis le bot.",
            );
          }
          throw new Error(
            payload?.error?.message ??
              payload?.message ??
              "La connexion Telegram n’a pas pu être vérifiée.",
          );
        }
        window.dispatchEvent(new Event("pokedex:session-ready"));
        router.refresh();
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFeedback(
          error instanceof Error
            ? error.message
            : "La connexion Telegram n’a pas pu être vérifiée.",
        );
      });

    return () => controller.abort();
  }, [router]);

  return feedback ? (
    <div className="telegram-auth-feedback" role="alert">
      {feedback}
    </div>
  ) : null;
}
