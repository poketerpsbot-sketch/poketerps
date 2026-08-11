import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Script from "next/script";
import { AgeGate } from "@/components/layout/age-gate";
import { AppShell } from "@/components/layout/app-shell";
import {
  AGE_GATE_CONFIRMED_VALUE,
  AGE_GATE_COOKIE_NAME,
  AGE_GATE_MAX_AGE_SECONDS,
  AGE_GATE_REJECTED_VALUE,
  AGE_GATE_STORAGE_KEY,
  isAgeGateConfirmed,
  isAgeGateRejected,
} from "@/lib/age-gate";
import "./globals.css";

const ageGateBootstrap = `try{const v=localStorage.getItem(${JSON.stringify(AGE_GATE_STORAGE_KEY)});if(v===${JSON.stringify(AGE_GATE_CONFIRMED_VALUE)}||v===${JSON.stringify(AGE_GATE_REJECTED_VALUE)}){document.documentElement.dataset.ageGateConfirmed=v===${JSON.stringify(AGE_GATE_CONFIRMED_VALUE)}?"true":"false";document.documentElement.dataset.ageGateRejected=v===${JSON.stringify(AGE_GATE_REJECTED_VALUE)}?"true":"false";document.cookie=${JSON.stringify(`${AGE_GATE_COOKIE_NAME}=`)}+v+${JSON.stringify(`; Path=/; Max-Age=${AGE_GATE_MAX_AGE_SECONDS}; SameSite=Lax`)}+(location.protocol==="https:"?"; Secure":"")}}catch{}`;

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const minimumAge = Number.parseInt(
    process.env.NEXT_PUBLIC_MINIMUM_AGE ?? process.env.MINIMUM_AGE ?? "18",
    10,
  );
  const ageGateEnabled =
    (process.env.NEXT_PUBLIC_AGE_GATE_ENABLED ?? process.env.AGE_GATE_ENABLED) === "true";
  const ageGateCookie = ageGateEnabled
    ? (await cookies()).get(AGE_GATE_COOKIE_NAME)?.value
    : AGE_GATE_CONFIRMED_VALUE;
  const ageGateConfirmed = isAgeGateConfirmed(ageGateCookie);
  const ageGateRejected = isAgeGateRejected(ageGateCookie);
  return (
    <html lang="fr">
      <body>
        <Script
          id="age-gate-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: ageGateBootstrap }}
        />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AppShell>{children}</AppShell>
        <AgeGate
          enabled={ageGateEnabled}
          initiallyConfirmed={ageGateConfirmed}
          initiallyRejected={ageGateRejected}
          minimumAge={Number.isFinite(minimumAge) ? minimumAge : 18}
        />
      </body>
    </html>
  );
}
