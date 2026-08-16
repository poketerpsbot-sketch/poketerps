"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";

import { UserAvatar } from "@/components/ui/user-avatar";

export type ScanResult = {
  id: string;
  kind:
    | "trend"
    | "discovery"
    | "recent"
    | "contest"
    | "contest-hub"
    | "progress"
    | "trainer"
    | "partner"
    | "ranking"
    | "search"
    | "mission"
    | "archive";
  label: string;
  title: string;
  subtitle?: string | null;
  href: string;
  action: string;
  icon: LucideIcon;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  stats?: Array<{ label: string; value: string }>;
};

export function ScanResultCard({ result, onRescan }: { result: ScanResult; onRescan: () => void }) {
  const Icon = result.icon;
  return (
    <article className={`scan-result-card scan-result-card--${result.kind}`}>
      <header className="scan-result-card__signal">
        <span>
          <Icon aria-hidden="true" />
        </span>
        <div>
          <small>Scan terminé</small>
          <strong>{result.label}</strong>
        </div>
        <i aria-hidden="true" />
      </header>
      <div className="scan-result-card__body">
        {result.avatarUrl !== undefined ? (
          <UserAvatar
            className="scan-result-card__avatar"
            displayName={result.title}
            src={result.avatarUrl}
          />
        ) : result.imageUrl ? (
          <span className="scan-result-card__media">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL de média déjà normalisée par le service catalogue. */}
            <img src={result.imageUrl} alt="" loading="lazy" decoding="async" />
          </span>
        ) : (
          <span className="scan-result-card__fallback" aria-hidden="true">
            <Icon />
          </span>
        )}
        <div className="scan-result-card__copy">
          <h3>{result.title}</h3>
          {result.subtitle && <p>{result.subtitle}</p>}
          {result.stats && result.stats.length > 0 && (
            <dl className="scan-result-card__stats">
              {result.stats.slice(0, 4).map((stat) => (
                <div key={`${stat.label}-${stat.value}`}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <footer>
        <Link className="button" href={result.href}>
          {result.action} <ArrowRight aria-hidden="true" />
        </Link>
        <button className="scan-result-card__rescan" type="button" onClick={onRescan}>
          <RotateCcw aria-hidden="true" /> Scanner à nouveau
        </button>
      </footer>
    </article>
  );
}
