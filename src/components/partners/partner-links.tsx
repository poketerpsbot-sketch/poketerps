"use client";

import { ArrowUpRight } from "lucide-react";
import type { PartnerDto } from "@/components/data/types";

function safeExternalUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

export function PartnerLinks({ partner }: { partner: PartnerDto }) {
  const links = [
    { label: "Site officiel", target: "website", href: safeExternalUrl(partner.websiteUrl) },
    { label: "Telegram", target: "telegram", href: safeExternalUrl(partner.telegramUrl) },
    { label: "Instagram", target: "instagram", href: safeExternalUrl(partner.instagramUrl) },
    { label: "Autre lien", target: "other", href: safeExternalUrl(partner.otherUrl) },
  ].filter((item): item is { label: string; target: string; href: string } => Boolean(item.href));

  if (links.length === 0) return <p>Aucun lien public n’est actuellement renseigné.</p>;

  return (
    <div className="button-row">
      {links.map((link) => (
        <a
          className="button button--secondary"
          href={link.href}
          target="_blank"
          rel="noreferrer"
          key={link.target}
          onClick={() => {
            void fetch(`/api/partners/${encodeURIComponent(String(partner.id))}/clicks`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ target: link.target }),
              keepalive: true,
            }).catch(() => undefined);
          }}
        >
          {link.label} <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
