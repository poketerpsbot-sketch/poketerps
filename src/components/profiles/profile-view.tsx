import Link from "next/link";
import {
  Award,
  BookOpen,
  ChevronRight,
  Heart,
  Mail,
  MessageSquare,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";
import type {
  EntrySummaryDto,
  PublicProfileDto,
  ReviewDto,
  SubmissionDto,
} from "@/components/data/types";
import { EntryGrid } from "@/components/entries/entry-card";
import { EmptyState, SectionHeading, StatusPill, formatDate } from "@/components/ui/states";

export type ProfilePayload = PublicProfileDto & {
  entries?: EntrySummaryDto[];
  captures?: EntrySummaryDto[];
  reviews?: ReviewDto[];
  favorites?: EntrySummaryDto[];
  submissions?: SubmissionDto[];
};

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
      (root.entries as EntrySummaryDto[] | undefined) ??
      (root.captures as EntrySummaryDto[] | undefined) ??
      profile.entries ??
      profile.captures,
    reviews: (root.reviews as ReviewDto[] | undefined) ?? profile.reviews,
    favorites: (root.favorites as EntrySummaryDto[] | undefined) ?? profile.favorites,
    submissions: (root.submissions as SubmissionDto[] | undefined) ?? profile.submissions,
  };
}

function profileUsername(profile: PublicProfileDto) {
  return profile.telegramUsername ?? profile.username;
}

function profileTitle(profile: PublicProfileDto) {
  return profile.profileTitle ?? profile.title ?? "Dresseur";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export function ProfileHero({ profile }: { profile: PublicProfileDto }) {
  const username = profileUsername(profile);
  return (
    <section className="profile-hero">
      <div>
        <div className="profile-identity">
          <span className="avatar" aria-hidden="true">
            {initials(profile.displayName)}
          </span>
          <div>
            <p className="eyebrow">Profil de Dresseur</p>
            <h1>{profile.displayName}</h1>
            <p>{username ? `@${username}` : profileTitle(profile)}</p>
          </div>
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {profile.badges && profile.badges.length > 0 && (
          <div className="badge-row" aria-label="Badges du Dresseur">
            {profile.badges.map((badge, index) => (
              <span className="tag" key={String(badge.id ?? `${badge.name}-${index}`)}>
                {badge.icon ?? "◆"} {badge.name}
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
          <span>Captures</span>
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
  { href: "/favoris", label: "Mes favoris", description: "Captures sauvegardées", icon: Heart },
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

export function MyProfileView({ profile }: { profile: ProfilePayload }) {
  return (
    <div className="page-shell page-stack">
      <ProfileHero profile={profile} />
      <nav className="profile-menu" aria-label="Mon espace">
        {menuItems.map(({ href, label, description, icon: Icon }) => (
          <Link href={href} key={href}>
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <section className="section-stack">
        <SectionHeading eyebrow="Progression" title="Journal du Dresseur" />
        <div className="stat-grid">
          <div className="stat-card">
            <span>Niveau</span>
            <strong>{profile.level ?? 1}</strong>
          </div>
          <div className="stat-card">
            <span>Expérience</span>
            <strong>{profile.experiencePoints ?? 0} XP</strong>
          </div>
          <div className="stat-card">
            <span>Captures</span>
            <strong>{profile.captureCount ?? 0}</strong>
          </div>
          <div className="stat-card">
            <span>Rang général</span>
            <strong>#{profile.rankOverall ?? "—"}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export function SubmissionList({ submissions }: { submissions: SubmissionDto[] }) {
  if (submissions.length === 0)
    return (
      <EmptyState
        title="Aucune proposition"
        description="Tes futures propositions et corrections apparaîtront ici."
        action={{ href: "/capturer", label: "Proposer une capture" }}
      />
    );
  return (
    <div className="list-stack">
      {submissions.map((submission) => (
        <article className="list-row" key={String(submission.id)}>
          <span className="category-card__icon" aria-hidden="true">
            <Award />
          </span>
          <div className="list-row__copy">
            <h3>
              {submission.entry?.name ?? submission.entryName ?? submission.title ?? "Proposition"}
            </h3>
            <p>
              {submission.type?.replaceAll("_", " ") ?? "Contribution"} ·{" "}
              {formatDate(submission.createdAt)}
            </p>
            {submission.moderationReason && <p>{submission.moderationReason}</p>}
          </div>
          <StatusPill value={submission.status} />
        </article>
      ))}
    </div>
  );
}
