import Link from "next/link";
import {
  Award,
  Bell,
  BookOpen,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  Mail,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  UserRound,
} from "lucide-react";

import type {
  BadgeDto,
  EntrySummaryDto,
  ExperienceOverviewDto,
  PublicProfileDto,
  ReviewDto,
  SubmissionDto,
} from "@/components/data/types";
import { EntryGrid } from "@/components/entries/entry-card";
import { XpProgressCard } from "@/components/profiles/xp-progress-card";
import { RoleBadge } from "@/components/ui/role-badge";
import { EmptyState, SectionHeading, StatusPill, formatDate } from "@/components/ui/states";
import {
  canAccessFullAdminConsole,
  canAccessModerationConsole,
  roleLabels,
} from "@/lib/auth/ui-access";
import type { UserRole } from "@/lib/db/schema";

export type ProfileStats = {
  entriesAdded?: number;
  entriesPublished?: number;
  entriesPending?: number;
  reviewsTotal?: number;
  reviewsPublished?: number;
  reviewsPending?: number;
  submissionsTotal?: number;
  submissionsPending?: number;
  favorites?: number;
  likes?: number;
  recentlyViewed?: number;
  badges?: number;
};

type ProfileCounts = {
  entries?: Record<string, number>;
  reviews?: Record<string, number>;
  submissions?: Record<string, number>;
};

type TelegramIdentity = {
  displayName?: string | null;
  username?: string | null;
  profilePhotoUrl?: string | null;
};

export type ProfilePayload = PublicProfileDto & {
  experience?: ExperienceOverviewDto;
  entries?: EntrySummaryDto[];
  captures?: EntrySummaryDto[];
  publishedEntries?: EntrySummaryDto[];
  reviews?: ReviewDto[];
  favorites?: EntrySummaryDto[];
  likedEntries?: EntrySummaryDto[];
  recentViews?: EntrySummaryDto[];
  submissions?: SubmissionDto[];
  telegramIdentity?: TelegramIdentity | null;
  stats?: ProfileStats | null;
  counts?: ProfileCounts | null;
  unreadNotificationCount?: number;
};

function arrayFrom<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

export function extractProfilePayload(payload: unknown): ProfilePayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const candidate = root.profile ?? root.user ?? root;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const profile = candidate as ProfilePayload;
  const ranks = profile.ranks ?? null;

  return {
    ...profile,
    publicSlug: profile.publicSlug ?? profile.slug,
    telegramUsername: profile.telegramUsername ?? profile.username,
    profileTitle: profile.profileTitle ?? profile.title,
    rankOverall: profile.rankOverall ?? ranks?.allRank,
    rankMonth: profile.rankMonth ?? ranks?.monthRank,
    rankWeek: profile.rankWeek ?? ranks?.weekRank,
    captureCount: profile.captureCount ?? ranks?.totalCaptures,
    entries:
      arrayFrom<EntrySummaryDto>(root.entries) ??
      arrayFrom<EntrySummaryDto>(root.captures) ??
      profile.entries ??
      profile.captures,
    publishedEntries: arrayFrom<EntrySummaryDto>(root.publishedEntries) ?? profile.publishedEntries,
    reviews: arrayFrom<ReviewDto>(root.reviews) ?? profile.reviews,
    favorites: arrayFrom<EntrySummaryDto>(root.favorites) ?? profile.favorites,
    likedEntries: arrayFrom<EntrySummaryDto>(root.likedEntries) ?? profile.likedEntries,
    recentViews: arrayFrom<EntrySummaryDto>(root.recentViews) ?? profile.recentViews,
    submissions: arrayFrom<SubmissionDto>(root.submissions) ?? profile.submissions,
    badges: arrayFrom<BadgeDto>(root.badges) ?? profile.badges,
    telegramIdentity:
      (root.telegramIdentity as TelegramIdentity | null | undefined) ?? profile.telegramIdentity,
    stats: (root.stats as ProfileStats | null | undefined) ?? profile.stats,
    counts: (root.counts as ProfileCounts | null | undefined) ?? profile.counts,
    unreadNotificationCount:
      typeof root.unreadNotificationCount === "number"
        ? root.unreadNotificationCount
        : profile.unreadNotificationCount,
    experience: (root.experience as ExperienceOverviewDto | undefined) ?? profile.experience,
  };
}

function profileUsername(profile: PublicProfileDto) {
  return profile.telegramUsername ?? profile.username;
}

function profileTitle(profile: PublicProfileDto) {
  return profile.profileTitle ?? profile.title ?? "Dresseur";
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toLocaleUpperCase("fr-FR") || "?"
  );
}

function safeAvatarUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

const userRoles: UserRole[] = ["OWNER", "ADMIN", "MODERATOR", "EDITOR", "MEMBER", "BANNED"];

function normalizedRole(value?: string | null): UserRole {
  return userRoles.includes(value as UserRole) ? (value as UserRole) : "MEMBER";
}

export function ProfileHero({ profile }: { profile: PublicProfileDto }) {
  const username = profileUsername(profile);
  const avatarUrl = safeAvatarUrl(profile.profilePhotoUrl);
  const role = profile.role ? normalizedRole(profile.role) : null;

  return (
    <section className="profile-hero">
      <div>
        <div className="profile-identity">
          <span
            className={`avatar${avatarUrl ? " profile-avatar--image" : ""}`}
            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
            role={avatarUrl ? "img" : undefined}
            aria-label={avatarUrl ? `Photo de profil de ${profile.displayName}` : undefined}
            aria-hidden={avatarUrl ? undefined : true}
          >
            {!avatarUrl && initials(profile.displayName)}
          </span>
          <div className="profile-identity__copy">
            <p className="eyebrow">Profil de Dresseur</p>
            <h1>{profile.displayName}</h1>
            <div className="profile-identity__meta">
              <span>{username ? `@${username}` : profileTitle(profile)}</span>
              {role && <RoleBadge role={role} compact />}
              <span>Niveau {profile.level ?? 1}</span>
            </div>
          </div>
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {profile.badges && profile.badges.length > 0 && (
          <div className="badge-row" aria-label="Badges du Dresseur">
            {profile.badges.slice(0, 4).map((badge, index) => (
              <span className="tag" key={String(badge.id ?? `${badge.name}-${index}`)}>
                {badge.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- asset local ou URL administrée.
                  <img className="profile-badge-mini" src={badge.imageUrl} alt="" />
                ) : (
                  (badge.icon ?? "◆")
                )}{" "}
                {badge.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="profile-ranks" aria-label="Classements">
        <div className="profile-rank">
          <span>Général</span>
          <strong>#{profile.rankOverall ?? "—"}</strong>
        </div>
        <div className="profile-rank">
          <span>Ce mois</span>
          <strong>#{profile.rankMonth ?? "—"}</strong>
        </div>
        <div className="profile-rank">
          <span>Cette semaine</span>
          <strong>#{profile.rankWeek ?? "—"}</strong>
        </div>
        <div className="profile-rank">
          <span>Captures publiées</span>
          <strong>{profile.captureCount ?? 0}</strong>
        </div>
      </div>
    </section>
  );
}

export function PublicProfileView({ profile }: { profile: ProfilePayload }) {
  const entries = profile.entries ?? [];
  return (
    <div className="page-shell page-stack">
      <ProfileHero profile={profile} />
      {profile.experience && <XpProgressCard experience={profile.experience} />}
      <div className="button-row">
        <Link className="button button--dark" href="/classements">
          <Trophy size={17} aria-hidden="true" /> Voir le classement
        </Link>
      </div>
      {profile.featuredEntry && (
        <section className="section-stack">
          <SectionHeading eyebrow="Capture épinglée" title="Découverte en vedette" />
          <EntryGrid entries={[profile.featuredEntry]} />
        </section>
      )}
      <section className="section-stack">
        <SectionHeading
          eyebrow="Archives du Dresseur"
          title="Captures publiées"
          description="Seules les fiches publiques sont visibles ici."
        />
        {entries.length > 0 ? (
          <EntryGrid entries={entries} />
        ) : (
          <EmptyState
            title="Aucune capture publique"
            description="Ce Dresseur n’a pas encore de fiche publiée visible."
          />
        )}
      </section>
    </div>
  );
}

const menuItems = [
  {
    href: "/profil/fiches",
    label: "Mes fiches",
    description: "Brouillons et captures",
    icon: BookOpen,
  },
  {
    href: "/profil/propositions",
    label: "Mes propositions",
    description: "Suivre la modération",
    icon: Sparkles,
  },
  {
    href: "/profil/avis",
    label: "Mes avis",
    description: "Avis publiés ou en attente",
    icon: MessageSquare,
  },
  {
    href: "/profil/notifications",
    label: "Notifications",
    description: "Réponses de l’équipe",
    icon: Bell,
  },
  { href: "/favoris", label: "Mes favoris", description: "Captures sauvegardées", icon: Heart },
  { href: "#badges", label: "Mes badges", description: "Récompenses obtenues", icon: Award },
  { href: "#aimees", label: "Mes J’aime", description: "Captures appréciées", icon: ThumbsUp },
  { href: "#historique", label: "Historique", description: "Consultations récentes", icon: Clock3 },
  {
    href: "/classements",
    label: "Mon classement",
    description: "Semaine, mois et général",
    icon: Trophy,
  },
  {
    href: "/contact",
    label: "Contacter l’équipe",
    description: "Question ou signalement",
    icon: Mail,
  },
  {
    href: "/profil/parametres",
    label: "Paramètres",
    description: "Profil et confidentialité",
    icon: Settings,
  },
] as const;

function statistic(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function EntryPreview({
  id,
  eyebrow,
  title,
  description,
  entries,
  emptyTitle,
  emptyDescription,
  action,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  entries: EntrySummaryDto[];
  emptyTitle: string;
  emptyDescription: string;
  action: { href: string; label: string };
}) {
  return (
    <section className="section-stack profile-dashboard-section" id={id}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} action={action} />
      {entries.length > 0 ? (
        <EntryGrid entries={entries.slice(0, 4)} />
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} action={action} />
      )}
    </section>
  );
}

function BadgeGallery({ badges }: { badges: BadgeDto[] }) {
  if (badges.length === 0) {
    return (
      <EmptyState
        title="Aucun badge pour le moment"
        description="Tes récompenses apparaîtront ici à mesure de tes contributions."
        action={{ href: "/capturer", label: "Contribuer" }}
      />
    );
  }

  return (
    <div className="profile-badge-grid">
      {badges.map((badge, index) => (
        <article className="profile-badge-card" key={String(badge.id ?? `${badge.name}-${index}`)}>
          {badge.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- asset local ou URL administrée.
            <img className="profile-badge-card__image" src={badge.imageUrl} alt="" />
          ) : (
            <span className="profile-badge-card__icon" aria-hidden="true">
              {badge.icon ?? "◆"}
            </span>
          )}
          <div>
            <h3>{badge.name}</h3>
            <p>{badge.description ?? "Récompense communautaire"}</p>
            {badge.rarity && (
              <span className={`badge-rarity badge-rarity--${badge.rarity.toLocaleLowerCase()}`}>
                {badge.rarity}
              </span>
            )}
            <small>
              Obtenu {formatDate(badge.awardedAt)}
              {badge.activeUntil ? ` · valable jusqu’au ${formatDate(badge.activeUntil)}` : ""}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

function ActivityList({ entries, kind }: { entries: EntrySummaryDto[]; kind: "liked" | "viewed" }) {
  const Icon = kind === "liked" ? ThumbsUp : Eye;
  const empty =
    kind === "liked"
      ? {
          title: "Aucune fiche aimée",
          description: "Les captures auxquelles tu ajoutes un J’aime apparaîtront ici.",
        }
      : {
          title: "Aucune vue récente",
          description: "Ton historique se remplira lorsque tu consulteras des captures.",
        };

  if (entries.length === 0) {
    return (
      <EmptyState
        title={empty.title}
        description={empty.description}
        action={{ href: "/explorer", label: "Explorer" }}
      />
    );
  }

  return (
    <div className="profile-activity-list">
      {entries.slice(0, 6).map((entry) => {
        const activityDate = kind === "liked" ? entry.likedAt : entry.viewedAt;
        return (
          <Link
            className="profile-activity-row"
            href={`/fiches/${encodeURIComponent(entry.slug)}`}
            key={String(entry.id)}
          >
            <span className="profile-activity-row__icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="profile-activity-row__copy">
              <strong>{entry.name}</strong>
              <small>
                {entry.category?.name ?? entry.categoryName ?? "Capture"} ·{" "}
                {formatDate(activityDate)}
              </small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}

function ReviewPreview({ reviews }: { reviews: ReviewDto[] }) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Aucun avis envoyé"
        description="Ouvre une capture pour déposer une évaluation soumise à validation."
        action={{ href: "/explorer", label: "Trouver une capture" }}
      />
    );
  }

  return (
    <div className="list-stack profile-review-list">
      {reviews.slice(0, 5).map((review) => (
        <article className="list-row profile-review-row" key={String(review.id)}>
          <span className="category-card__icon" aria-hidden="true">
            <Star />
          </span>
          <div className="list-row__copy">
            <h3>
              {review.entrySlug ? (
                <Link href={`/fiches/${encodeURIComponent(review.entrySlug)}`}>
                  {review.entry?.name ?? review.entryName ?? "Avis"}
                </Link>
              ) : (
                (review.entry?.name ?? review.entryName ?? "Avis")
              )}
            </h3>
            <p className="profile-review-row__content">{review.content}</p>
            {review.moderationReason && (
              <p>
                <strong>Retour de la modération :</strong> {review.moderationReason}
              </p>
            )}
            <p>Mis à jour le {formatDate(review.updatedAt ?? review.createdAt)}</p>
          </div>
          <div className="list-row__meta">
            ★ {Number(review.overallRating).toLocaleString("fr-CH", { maximumFractionDigits: 1 })}
            <br />
            <StatusPill value={review.status} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function MyProfileView({ profile }: { profile: ProfilePayload }) {
  const role = normalizedRole(profile.role);
  const identity = profile.telegramIdentity ?? {};
  const entries = profile.entries ?? [];
  const publishedEntries = profile.publishedEntries ?? [];
  const favorites = profile.favorites ?? [];
  const likedEntries = profile.likedEntries ?? [];
  const recentViews = profile.recentViews ?? [];
  const submissions = profile.submissions ?? [];
  const reviews = profile.reviews ?? [];
  const badges = profile.badges ?? [];
  const stats = profile.stats ?? {};
  const telegramName = identity.displayName ?? profile.displayName;
  const telegramUsername = identity.username ?? profileUsername(profile);
  const profileWithIdentity = {
    ...profile,
    displayName: telegramName,
    telegramUsername,
    profilePhotoUrl: identity.profilePhotoUrl ?? profile.profilePhotoUrl,
  };
  const canAdminister = canAccessFullAdminConsole(role);
  const canModerate = canAccessModerationConsole(role);

  const statCards = [
    { label: "Niveau", value: profile.level ?? 1 },
    { label: "Expérience", value: `${profile.experiencePoints ?? 0} XP` },
    {
      label: "Fiches publiées",
      value: statistic(stats.entriesPublished, profile.captureCount ?? publishedEntries.length),
    },
    { label: "Fiches ajoutées", value: statistic(stats.entriesAdded, entries.length) },
    { label: "Propositions", value: statistic(stats.submissionsTotal, submissions.length) },
    { label: "Avis", value: statistic(stats.reviewsTotal, reviews.length) },
    { label: "Favoris", value: statistic(stats.favorites, favorites.length) },
    { label: "Fiches aimées", value: statistic(stats.likes, likedEntries.length) },
  ];

  return (
    <div className="page-shell page-stack profile-dashboard">
      <ProfileHero profile={profileWithIdentity} />
      {profile.experience && <XpProgressCard experience={profile.experience} showHistory />}

      {canModerate && (
        <aside className="profile-admin-access" aria-labelledby="profile-admin-title">
          <span className="profile-admin-access__icon" aria-hidden="true">
            <ShieldCheck />
          </span>
          <div>
            <p className="eyebrow">Accès autorisé</p>
            <h2 id="profile-admin-title">
              {canAdminister ? "Panneau d’administration" : "Espace de modération"}
            </h2>
            <p>
              {canAdminister
                ? "Gère les contenus, les utilisateurs et les réglages selon tes permissions."
                : "Valide les fiches, les avis, les messages et les participations selon tes permissions."}
            </p>
          </div>
          <Link
            className="button button--dark"
            href={canAdminister ? "/admin" : "/admin/moderation"}
          >
            {canAdminister ? "Ouvrir le panneau" : "Ouvrir la modération"}{" "}
            <ChevronRight size={17} aria-hidden="true" />
          </Link>
        </aside>
      )}

      <section className="section-stack">
        <SectionHeading
          eyebrow="Raccourcis"
          title="Mon espace"
          description="Accède rapidement à tes contenus, activités et paramètres."
        />
        <nav className="profile-menu" aria-label="Mon espace">
          {menuItems.map(({ href, label, description, icon: Icon }) => (
            <Link href={href} key={href}>
              <Icon size={20} aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              {href === "/profil/notifications" &&
                Number(profile.unreadNotificationCount ?? 0) > 0 && (
                  <span
                    className="profile-menu__count"
                    aria-label={`${profile.unreadNotificationCount} non lues`}
                  >
                    {profile.unreadNotificationCount}
                  </span>
                )}
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>

      <section className="section-stack" id="progression">
        <SectionHeading
          eyebrow="Progression"
          title="Journal du Dresseur"
          description="Des compteurs personnels calculés à partir de ton activité enregistrée."
        />
        <div className="profile-overview-grid">
          <article className="content-panel profile-telegram-card">
            <div className="profile-panel-title">
              <UserRound aria-hidden="true" />
              <div>
                <p className="eyebrow">Compte lié</p>
                <h3>Identité Telegram</h3>
              </div>
            </div>
            <dl className="data-list">
              <div>
                <dt>Nom Telegram</dt>
                <dd>{telegramName}</dd>
              </div>
              <div>
                <dt>Nom d’utilisateur</dt>
                <dd>{telegramUsername ? `@${telegramUsername}` : "Non renseigné"}</dd>
              </div>
              <div>
                <dt>Rôle</dt>
                <dd>{roleLabels[role]}</dd>
              </div>
              <div>
                <dt>Membre depuis</dt>
                <dd>{formatDate(profile.createdAt)}</dd>
              </div>
            </dl>
          </article>
          <div className="stat-grid profile-stat-grid">
            {statCards.map((card) => (
              <div className="stat-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-stack profile-dashboard-section" id="badges">
        <SectionHeading
          eyebrow="Récompenses"
          title="Mes badges"
          description={`${statistic(stats.badges, badges.length)} badge${statistic(stats.badges, badges.length) > 1 ? "s" : ""} actif${statistic(stats.badges, badges.length) > 1 ? "s" : ""}.`}
        />
        <BadgeGallery badges={badges} />
      </section>

      <EntryPreview
        eyebrow="Contributions publiques"
        title="Fiches publiées"
        description="Les captures publiées qui te créditent comme contributeur d’origine."
        entries={publishedEntries}
        emptyTitle="Aucune fiche publiée"
        emptyDescription="Tes contributions validées et publiées apparaîtront ici."
        action={{ href: "/profil/fiches", label: "Voir mes fiches" }}
      />

      <EntryPreview
        eyebrow="Atelier personnel"
        title="Fiches ajoutées"
        description="Brouillons, validations en cours et fiches déjà publiées créées par ton compte."
        entries={entries}
        emptyTitle="Aucune fiche ajoutée"
        emptyDescription="Commence une capture ; elle sera conservée comme brouillon avant soumission."
        action={{ href: "/capturer", label: "Ajouter une fiche" }}
      />

      <section className="section-stack profile-dashboard-section" id="propositions">
        <SectionHeading
          eyebrow="Suivi communautaire"
          title="Mes propositions"
          description={`${statistic(stats.submissionsPending, 0)} proposition${statistic(stats.submissionsPending, 0) > 1 ? "s" : ""} en attente de modération.`}
          action={{ href: "/profil/propositions", label: "Tout voir" }}
        />
        <SubmissionList submissions={submissions.slice(0, 5)} />
      </section>

      <EntryPreview
        eyebrow="Collection personnelle"
        title="Mes favoris"
        description="Les captures sauvegardées pour les retrouver rapidement."
        entries={favorites}
        emptyTitle="Ta collection est vide"
        emptyDescription="Ajoute une capture à tes favoris depuis sa fiche."
        action={{ href: "/favoris", label: "Voir mes favoris" }}
      />

      <div className="profile-activity-grid">
        <section className="content-panel profile-activity-panel" id="aimees">
          <SectionHeading
            eyebrow="Appréciations"
            title="Fiches aimées"
            description={`${statistic(stats.likes, likedEntries.length)} capture${statistic(stats.likes, likedEntries.length) > 1 ? "s" : ""} aimée${statistic(stats.likes, likedEntries.length) > 1 ? "s" : ""}.`}
          />
          <ActivityList entries={likedEntries} kind="liked" />
        </section>
        <section className="content-panel profile-activity-panel" id="historique">
          <SectionHeading
            eyebrow="Historique"
            title="Vues récentes"
            description={`${statistic(stats.recentlyViewed, recentViews.length)} capture${statistic(stats.recentlyViewed, recentViews.length) > 1 ? "s" : ""} distincte${statistic(stats.recentlyViewed, recentViews.length) > 1 ? "s" : ""} consultée${statistic(stats.recentlyViewed, recentViews.length) > 1 ? "s" : ""}.`}
          />
          <ActivityList entries={recentViews} kind="viewed" />
        </section>
      </div>

      <section className="section-stack profile-dashboard-section" id="avis">
        <SectionHeading
          eyebrow="Évaluations"
          title="Mes avis"
          description={`${statistic(stats.reviewsPublished, 0)} publié${statistic(stats.reviewsPublished, 0) > 1 ? "s" : ""} · ${statistic(stats.reviewsPending, 0)} en attente.`}
          action={{ href: "/profil/avis", label: "Tous mes avis" }}
        />
        <ReviewPreview reviews={reviews} />
      </section>
    </div>
  );
}

export function SubmissionList({ submissions }: { submissions: SubmissionDto[] }) {
  if (submissions.length === 0) {
    return (
      <EmptyState
        title="Aucune proposition"
        description="Tes futures propositions et corrections apparaîtront ici."
        action={{ href: "/capturer", label: "Proposer une capture" }}
      />
    );
  }

  return (
    <div className="list-stack">
      {submissions.map((submission) => (
        <article className="list-row" key={String(submission.id)}>
          <span className="category-card__icon" aria-hidden="true">
            <Award />
          </span>
          <div className="list-row__copy">
            <h3>
              {submission.entrySlug ? (
                <Link href={`/fiches/${encodeURIComponent(submission.entrySlug)}`}>
                  {submission.entry?.name ??
                    submission.entryName ??
                    submission.title ??
                    "Proposition"}
                </Link>
              ) : (
                (submission.entry?.name ??
                submission.entryName ??
                submission.title ??
                "Proposition")
              )}
            </h3>
            <p>
              {submission.type?.replaceAll("_", " ") ?? "Contribution"} ·{" "}
              {formatDate(submission.submittedAt ?? submission.createdAt)}
            </p>
            {submission.moderationReason && <p>{submission.moderationReason}</p>}
          </div>
          <StatusPill value={submission.status} />
        </article>
      ))}
    </div>
  );
}
