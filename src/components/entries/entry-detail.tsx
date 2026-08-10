import Link from "next/link";
import Image from "next/image";
import { Eye, Heart, MessageCircle, Star, Trophy } from "lucide-react";
import type { EntryDetailDto, ReviewDto } from "@/components/data/types";
import { EntryActions } from "@/components/entries/entry-actions";
import { ViewTracker } from "@/components/entries/view-tracker";
import { EmptyState, formatCount, formatDate, SectionHeading } from "@/components/ui/states";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function publicNumber(value?: number | string | null) {
  if (value === null || value === undefined) return "#----";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `#${String(numeric).padStart(4, "0")}` : `#${value}`;
}

function rating(value?: number | string | null) {
  const numeric = Number(value);
  return numeric > 0 ? numeric.toLocaleString("fr-CH", { maximumFractionDigits: 1 }) : "—";
}

function contributor(entry: EntryDetailDto) {
  return entry.contributor ?? entry.author ?? null;
}

function profileSlug(profile: NonNullable<EntryDetailDto["author"]>) {
  return profile.publicSlug ?? profile.slug ?? String(profile.id ?? "");
}

function profileUsername(profile: NonNullable<EntryDetailDto["author"]>) {
  return profile.telegramUsername ?? profile.username;
}

function dynamicFields(entry: EntryDetailDto) {
  if (entry.fieldValues) return entry.fieldValues;

  return Object.entries(entry.fields ?? {}).map(([key, value], index) => ({
    id: undefined,
    label: /^[0-9a-f-]{36}$/i.test(key) ? `Caractéristique ${index + 1}` : key,
    value: Array.isArray(value)
      ? value.map(String)
      : typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : (value as string | number | null),
    unit: null,
  }));
}

function micronLabel(entry: EntryDetailDto) {
  if (entry.micronLabel) return entry.micronLabel;
  if (entry.micron?.displayLabel) return entry.micron.displayLabel;

  if (
    entry.micron?.mode === "SINGLE" &&
    entry.micron.singleValue !== null &&
    entry.micron.singleValue !== undefined
  ) {
    return `${entry.micron.singleValue} µm`;
  }
  if (
    entry.micron?.mode === "RANGE" &&
    entry.micron.minimumValue !== null &&
    entry.micron.minimumValue !== undefined &&
    entry.micron.maximumValue !== null &&
    entry.micron.maximumValue !== undefined
  ) {
    return `${entry.micron.minimumValue}–${entry.micron.maximumValue} µm`;
  }
  if (entry.micron?.mode === "MULTIPLE" && entry.micron.multipleValues?.length) {
    return `${entry.micron.multipleValues.join(", ")} µm`;
  }
  if (entry.micron?.mode === "FULL_SPECTRUM") return "Full Spectrum";
  if (entry.micron?.mode === "MIXED") return "Mixed Micron";
  if (entry.micronMin !== null && entry.micronMin !== undefined) {
    return `${entry.micronMin}${entry.micronMax !== null && entry.micronMax !== undefined ? `–${entry.micronMax}` : ""} µm`;
  }
  return null;
}

export function EntryDetail({ entry, reviews }: { entry: EntryDetailDto; reviews: ReviewDto[] }) {
  const author = contributor(entry);
  const fields = dynamicFields(entry);
  const micron = micronLabel(entry);
  const heroImage = entry.images?.find((image) => image.isPrimary) ?? entry.images?.[0];
  const heroImageUrl = entry.primaryImageUrl ?? heroImage?.url ?? null;
  const hasImageAttribution = Boolean(
    heroImage?.sourceUrl && heroImage.credit && heroImage.licenseName && heroImage.licenseUrl,
  );

  return (
    <div className="page-shell page-stack">
      <ViewTracker entryId={String(entry.id)} />
      <article className="detail-hero">
        <figure className="detail-hero__visual">
          {heroImageUrl && (
            <Image
              className="detail-hero__image"
              src={heroImageUrl}
              alt={heroImage?.altText ?? heroImage?.alt ?? `Photo principale de ${entry.name}`}
              fill
              sizes="(max-width: 819px) 100vw, 45vw"
              priority
            />
          )}
          <span className="detail-hero__number">CAPTURE {publicNumber(entry.publicNumber)}</span>
          {!heroImageUrl && (
            <span className="detail-hero__glyph" aria-hidden="true">
              {initials(entry.name)}
            </span>
          )}
          <span className="scanner-line" aria-hidden="true" />
          {hasImageAttribution && heroImage && (
            <figcaption className="detail-hero__attribution">
              Photo d’illustration — Crédit : {heroImage.credit}. Licence :{" "}
              <a href={heroImage.licenseUrl ?? undefined} target="_blank" rel="noreferrer">
                {heroImage.licenseName}
              </a>
              .{" "}
              <a href={heroImage.sourceUrl ?? undefined} target="_blank" rel="noreferrer">
                Source Wikimedia Commons
              </a>
              . Image redimensionnée et convertie en WebP.
            </figcaption>
          )}
        </figure>
        <div className="detail-hero__copy">
          <span className="type-badge">
            {entry.category?.name ?? entry.categoryName ?? "Non classée"}
          </span>
          <h1>{entry.name}</h1>
          {entry.shortDescription && (
            <p className="detail-hero__description">{entry.shortDescription}</p>
          )}
          <div className="entry-stats">
            <span>
              <Star aria-hidden="true" /> {rating(entry.averageRating)}/10
            </span>
            <span>
              <Eye aria-hidden="true" /> {formatCount(entry.viewCount)} vues
            </span>
            <span>
              <Heart aria-hidden="true" /> {formatCount(entry.likeCount)} J’aime
            </span>
            <span>
              <MessageCircle aria-hidden="true" /> {formatCount(entry.reviewCount)} avis
            </span>
          </div>
        </div>
      </article>

      <div className="detail-layout">
        <div className="detail-content">
          <section className="content-panel">
            <h2>Rapport de découverte</h2>
            {entry.fullDescription ? (
              entry.fullDescription
                .split(/\n{2,}/)
                .map((paragraph, index) => <p key={index}>{paragraph}</p>)
            ) : (
              <p>Cette capture ne possède pas encore de description éditoriale détaillée.</p>
            )}
          </section>

          {(fields.length > 0 || micron || entry.subcategory) && (
            <section className="content-panel">
              <h2>Données analysées</h2>
              <dl className="data-list">
                {entry.subcategory && (
                  <div>
                    <dt>Sous-catégorie</dt>
                    <dd>{entry.subcategory.name}</dd>
                  </div>
                )}
                {micron && (
                  <div>
                    <dt>Microns déclarés</dt>
                    <dd>{micron}</dd>
                  </div>
                )}
                {entry.rarity && (
                  <div>
                    <dt>Rareté</dt>
                    <dd>{entry.rarity}</dd>
                  </div>
                )}
                {fields.map((field, index) => (
                  <div key={field.id ? String(field.id) : `${field.label}-${index}`}>
                    <dt>{field.label}</dt>
                    <dd>
                      {Array.isArray(field.value) ? field.value.join(", ") : (field.value ?? "—")}
                      {field.unit ? ` ${field.unit}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="content-panel section-stack">
            <SectionHeading
              title="Avis vérifiés"
              description="Chaque avis est relu avant sa publication."
              action={{ href: `/fiches/${entry.slug}/avis`, label: "Donner mon avis" }}
            />
            {reviews.length === 0 ? (
              <EmptyState
                title="Aucun avis publié"
                description="Sois le premier dresseur à partager une évaluation vérifiable."
              />
            ) : (
              <div className="list-stack">
                {reviews.map((review) => (
                  <article className="list-row" key={String(review.id)}>
                    <span className="avatar" aria-hidden="true">
                      {initials(
                        review.author?.displayName ?? review.authorDisplayNameSnapshot ?? "D",
                      )}
                    </span>
                    <div className="list-row__copy">
                      <h3>
                        {review.author?.displayName ??
                          review.authorDisplayNameSnapshot ??
                          "Dresseur"}
                      </h3>
                      {(review.author?.telegramUsername ??
                        review.author?.username ??
                        review.authorUsernameSnapshot) && (
                        <p>
                          @
                          {review.author?.telegramUsername ??
                            review.author?.username ??
                            review.authorUsernameSnapshot}
                        </p>
                      )}
                      <p>{review.content}</p>
                      <p>{formatDate(review.publishedAt ?? review.createdAt)}</p>
                    </div>
                    <strong className="list-row__meta">★ {rating(review.overallRating)}/10</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-sidebar" aria-label="Informations et actions">
          <section className="content-panel">
            <h2>Actions</h2>
            <EntryActions
              entryId={String(entry.id)}
              slug={entry.slug}
              initialLiked={entry.isLiked}
              initialFavorited={entry.isFavorited}
              initialLikeCount={entry.likeCount ?? 0}
            />
          </section>

          <section className="content-panel">
            <h2>Capturé par</h2>
            {author ? (
              <Link
                className="contributor-card"
                href={`/profil/${encodeURIComponent(profileSlug(author))}`}
              >
                <span className="avatar" aria-hidden="true">
                  {initials(author.displayName)}
                </span>
                <span className="contributor-card__copy">
                  <strong>{author.displayName}</strong>
                  <span>
                    {profileUsername(author)
                      ? `@${profileUsername(author)}`
                      : (author.profileTitle ?? author.title ?? "Dresseur")}
                  </span>
                  <span>
                    <Trophy size={13} aria-hidden="true" /> {author.captureCount ?? 0} captures
                  </span>
                </span>
              </Link>
            ) : (
              <p>Contributeur non renseigné.</p>
            )}
          </section>

          <section className="content-panel">
            <h2>Traçabilité</h2>
            <dl className="data-list">
              <div>
                <dt>Numéro public</dt>
                <dd>{publicNumber(entry.publicNumber)}</dd>
              </div>
              <div>
                <dt>Publication</dt>
                <dd>{formatDate(entry.publishedAt)}</dd>
              </div>
              <div>
                <dt>Dernière mise à jour</dt>
                <dd>{formatDate(entry.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
