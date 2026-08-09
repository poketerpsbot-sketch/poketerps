import Link from "next/link";
import Image from "next/image";
import { Eye, Heart, MessageCircle, Star } from "lucide-react";
import type { EntrySummaryDto } from "@/components/data/types";
import { formatCount, StatusPill } from "@/components/ui/states";

function entryNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "#----";
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? `#${String(asNumber).padStart(4, "0")}` : `#${String(value)}`;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toLocaleUpperCase("fr-FR") || "?"
  );
}

function categoryName(entry: EntrySummaryDto) {
  return entry.category?.name ?? entry.categoryName ?? "Non classée";
}

function rating(value?: number | string | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? numeric.toLocaleString("fr-CH", { maximumFractionDigits: 1 })
    : "—";
}

export function EntryCard({ entry }: { entry: EntrySummaryDto }) {
  return (
    <Link className="entry-card" href={`/fiches/${encodeURIComponent(entry.slug)}`}>
      <div className="entry-card__visual">
        {entry.primaryImageUrl && (
          <Image
            className="entry-card__image"
            src={entry.primaryImageUrl}
            alt={`Photo de ${entry.name}`}
            fill
            sizes="(max-width: 559px) 100vw, (max-width: 819px) 50vw, (max-width: 1079px) 33vw, 25vw"
          />
        )}
        <span className="entry-card__number">{entryNumber(entry.publicNumber)}</span>
        {entry.status && entry.status !== "PUBLISHED" && (
          <span className="entry-card__status">
            <StatusPill value={entry.status} />
          </span>
        )}
        {!entry.primaryImageUrl && (
          <span className="entry-card__glyph" aria-hidden="true">
            {initials(entry.name)}
          </span>
        )}
        <span className="entry-card__scan" aria-hidden="true" />
      </div>
      <div className="entry-card__body">
        <div>
          <span className="type-badge">{categoryName(entry)}</span>
          <h3>{entry.name}</h3>
          {entry.shortDescription && <p>{entry.shortDescription}</p>}
        </div>
        <div className="entry-card__stats" aria-label="Statistiques de la fiche">
          <span aria-label={`Note ${rating(entry.averageRating)} sur 10`}>
            <Star aria-hidden="true" /> {rating(entry.averageRating)}
          </span>
          <span aria-label={`${formatCount(entry.viewCount)} vues`}>
            <Eye aria-hidden="true" /> {formatCount(entry.viewCount)}
          </span>
          <span aria-label={`${formatCount(entry.likeCount)} J’aime`}>
            <Heart aria-hidden="true" /> {formatCount(entry.likeCount)}
          </span>
          <span aria-label={`${formatCount(entry.reviewCount)} avis`}>
            <MessageCircle aria-hidden="true" /> {formatCount(entry.reviewCount)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function EntryGrid({ entries }: { entries: EntrySummaryDto[] }) {
  return (
    <div className="entry-grid">
      {entries.map((entry) => (
        <EntryCard entry={entry} key={String(entry.id)} />
      ))}
    </div>
  );
}
