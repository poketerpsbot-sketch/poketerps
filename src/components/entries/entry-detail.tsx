import Link from "next/link";
import Image from "next/image";
import { Eye, Heart, MessageCircle, Star, Trophy } from "lucide-react";
import type { EntryDetailDto, ReviewDto } from "@/components/data/types";
import { EntryActions } from "@/components/entries/entry-actions";
import { prepareDynamicFieldDisplay } from "@/components/entries/entry-detail-fields";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ViewTracker } from "@/components/entries/view-tracker";
import { EmptyState, formatCount, formatDate, SectionHeading } from "@/components/ui/states";
import { BackLink } from "@/components/ui/back-link";
import { withReturnTo } from "@/lib/navigation";

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

  return Object.entries(entry.fields ?? {}).map(([, value], index) => ({
    id: undefined,
    // Sans définition jointe, la clé peut être un UUID ou un nom technique :
    // elle ne doit jamais devenir un libellé visible pour le public.
    label: `Caractéristique ${index + 1}`,
    value: Array.isArray(value)
      ? value.map(String)
      : typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : (value as string | number | null),
    unit: null,
  }));
}

function micronSpecificationLabel(entry: NonNullable<EntryDetailDto["micron"]>) {
  if (entry.displayLabel) return entry.displayLabel;
  if (entry.mode === "SINGLE" && entry.singleValue !== null && entry.singleValue !== undefined) {
    return `${entry.singleValue} µm`;
  }
  if (
    entry.mode === "RANGE" &&
    entry.minimumValue !== null &&
    entry.minimumValue !== undefined &&
    entry.maximumValue !== null &&
    entry.maximumValue !== undefined
  ) {
    return `${entry.minimumValue}–${entry.maximumValue} µm`;
  }
  if (entry.mode === "MULTIPLE" && entry.multipleValues?.length) {
    return `${entry.multipleValues.join(", ")} µm`;
  }
  if (entry.mode === "FULL_SPECTRUM") return "Full Spectrum";
  if (entry.mode === "MIXED") return "Mixed Micron";
  return null;
}

function micronLabel(entry: EntryDetailDto) {
  if (entry.micronLabel) return entry.micronLabel;
  if (entry.micron) {
    const label = micronSpecificationLabel(entry.micron);
    if (label) return label;
  }
  if (entry.micronMin !== null && entry.micronMin !== undefined) {
    return `${entry.micronMin}${entry.micronMax !== null && entry.micronMax !== undefined ? `–${entry.micronMax}` : ""} µm`;
  }
  return null;
}

export function EntryDetail({
  entry,
  reviews,
  telegramBotUsername,
}: {
  entry: EntryDetailDto;
  reviews: ReviewDto[];
  telegramBotUsername?: string | null;
}) {
  const author = contributor(entry);
  const fields = dynamicFields(entry);
  const { labeledFields, declaredValues } = prepareDynamicFieldDisplay(fields, [
    entry.category?.name,
    entry.categoryName,
    entry.subcategory?.name,
  ]);
  const micron = micronLabel(entry);
  const micronContexts = (entry.micronContexts ?? [])
    .map((context) => ({ ...context, label: micronSpecificationLabel(context) }))
    .filter((context) => context.label);
  const primaryAroma = entry.aromas?.find((aroma) => aroma.importance === "PRIMARY");
  const secondaryAromas = entry.aromas?.filter((aroma) => aroma.importance === "SECONDARY") ?? [];
  const heroImage = entry.images?.find((image) => image.isPrimary) ?? entry.images?.[0];
  const heroImageUrl = entry.primaryImageUrl ?? heroImage?.url ?? null;
  const hasImageAttribution = Boolean(
    heroImage?.sourceUrl && heroImage.credit && heroImage.licenseName && heroImage.licenseUrl,
  );

  return (
    <div className="page-shell page-stack">
      <BackLink fallbackHref="/explorer" />
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

          {(primaryAroma || secondaryAromas.length > 0) && (
            <section className="content-panel aroma-profile">
              <p className="eyebrow">Profil sensoriel</p>
              <h2>Arômes</h2>
              {primaryAroma && (
                <div className="aroma-profile__group">
                  <h3>Arôme principal</h3>
                  <span className="aroma-chip aroma-chip--primary">
                    {primaryAroma.customLabel ?? primaryAroma.name}
                  </span>
                </div>
              )}
              {secondaryAromas.length > 0 && (
                <div className="aroma-profile__group">
                  <h3>Arômes secondaires</h3>
                  <div className="aroma-profile__chips">
                    {secondaryAromas.map((aroma) => (
                      <span className="aroma-chip" key={String(aroma.id)}>
                        {aroma.customLabel ?? aroma.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {(labeledFields.length > 0 ||
            declaredValues.length > 0 ||
            micron ||
            micronContexts.length > 0 ||
            entry.subcategory) && (
            <section className="content-panel">
              <h2>Données analysées</h2>
              <dl className="data-list">
                {entry.subcategory && (
                  <div>
                    <dt>Sous-catégorie</dt>
                    <dd>{entry.subcategory.name}</dd>
                  </div>
                )}
                {micronContexts.length > 0
                  ? micronContexts.map((context) => (
                      <div key={context.context}>
                        <dt>
                          {context.context === "PRESSING_BAG"
                            ? "Micron du sac de pressage"
                            : "Microns de collecte / séparation"}
                        </dt>
                        <dd>{context.label}</dd>
                      </div>
                    ))
                  : micron && (
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
                {labeledFields.map((field, index) => (
                  <div key={field.id ? String(field.id) : `${field.label}-${index}`}>
                    <dt>{field.label}</dt>
                    <dd>
                      {field.value}
                      {field.unit ? ` ${field.unit}` : ""}
                    </dd>
                  </div>
                ))}
                {declaredValues.length > 0 && (
                  <div>
                    <dt>Détails déclarés</dt>
                    <dd className="declared-details">
                      {declaredValues.map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section className="content-panel section-stack">
            <SectionHeading
              title="Avis vérifiés"
              description="Chaque avis est relu avant sa publication."
              action={{
                href: withReturnTo(`/fiches/${entry.slug}/avis`, `/fiches/${entry.slug}`),
                label: "Donner mon avis",
              }}
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
              entryName={entry.name}
              shareDescription={entry.shortDescription}
              telegramBotUsername={telegramBotUsername}
              canShare={entry.status === "PUBLISHED"}
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
                href={withReturnTo(
                  `/profil/${encodeURIComponent(profileSlug(author))}`,
                  `/fiches/${encodeURIComponent(entry.slug)}`,
                )}
              >
                <UserAvatar
                  className="contributor-card__avatar"
                  displayName={author.displayName}
                  src={author.profilePhotoUrl}
                  eager
                />
                <span className="contributor-card__copy">
                  <strong>{author.displayName}</strong>
                  {profileUsername(author) && <span>@{profileUsername(author)}</span>}
                  <span>{author.profileTitle ?? author.title ?? "Dresseur"}</span>
                  <span className="contributor-card__stats">
                    <Trophy size={14} aria-hidden="true" /> {formatCount(author.captureCount)}{" "}
                    captures
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
