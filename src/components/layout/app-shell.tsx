import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { TelegramBridge } from "@/components/layout/telegram-bridge";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <TelegramBridge />
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <Topbar />
      <main id="main-content" className="app-main">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
