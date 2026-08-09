import Link from "next/link";
import { AlertTriangle, Inbox, LoaderCircle, RotateCcw } from "lucide-react";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <header className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && (
        <Link className="text-link" href={action.href}>
          {action.label}
          <span aria-hidden="true"> →</span>
        </Link>
      )}
    </header>
  );
}

export function EmptyState({
  title = "Aucune découverte pour le moment",
  description = "Les prochaines captures publiées apparaîtront ici.",
  action,
}: {
  title?: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="state-card state-card--empty">
      <Inbox aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action && (
        <Link className="button button--secondary" href={action.href}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Signal interrompu",
  message,
  retryHref,
}: {
  title?: string;
  message: string;
  retryHref?: string;
}) {
  return (
    <div className="state-card state-card--error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      {retryHref && (
        <Link className="button button--secondary" href={retryHref}>
          <RotateCcw size={16} aria-hidden="true" /> Réessayer
        </Link>
      )}
    </div>
  );
}

export function LoadingState({ label = "Analyse en cours…" }: { label?: string }) {
  return (
    <div className="state-card state-card--loading" role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <div>
        <h3>{label}</h3>
        <p>Le scanner synchronise les données du Pokédex.</p>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="entry-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <span className="skeleton skeleton--media" />
          <span className="skeleton skeleton--short" />
          <span className="skeleton" />
          <span className="skeleton skeleton--medium" />
        </div>
      ))}
    </div>
  );
}

export function StatusPill({ value }: { value?: string | null }) {
  const normalized = value?.toLowerCase().replaceAll("_", "-") ?? "inconnu";
  const label = value ? value.replaceAll("_", " ").toLocaleLowerCase("fr-FR") : "inconnu";
  return <span className={`status-pill status-pill--${normalized}`}>{label}</span>;
}

export function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-CH", { notation: "compact" }).format(value ?? 0);
}

export function formatDate(value?: string | null) {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
