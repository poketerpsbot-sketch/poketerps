import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { AgeGate } from "@/components/layout/age-gate";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pokédex — Archives communautaires",
    template: "%s · Pokédex",
  },
  description: "Catalogue éditorial communautaire de découvertes, avis vérifiés et dresseurs.",
  applicationName: "Pokédex",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c9172c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const minimumAge = Number.parseInt(
    process.env.NEXT_PUBLIC_MINIMUM_AGE ?? process.env.MINIMUM_AGE ?? "18",
    10,
  );
  const ageGateEnabled =
    (process.env.NEXT_PUBLIC_AGE_GATE_ENABLED ?? process.env.AGE_GATE_ENABLED) === "true";
  return (
    <html lang="fr">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AppShell>{children}</AppShell>
        <AgeGate
          enabled={ageGateEnabled}
          minimumAge={Number.isFinite(minimumAge) ? minimumAge : 18}
        />
      </body>
    </html>
  );
}
