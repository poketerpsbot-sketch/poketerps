import {
  Award,
  BookOpen,
  Crown,
  Eye,
  Medal,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import type { BadgeDto } from "@/components/data/types";
import type { UserRole } from "@/lib/db/schema";

type BadgeFamily =
  "role" | "level" | "contribution" | "review" | "contest" | "community" | "special";

type BadgeVisual = {
  family: BadgeFamily;
  tier: number;
  role?: UserRole;
  Icon: LucideIcon;
};

type BadgeVisualInput = Pick<BadgeDto, "slug" | "category" | "criteria">;

const roleVisuals: Record<UserRole, Omit<BadgeVisual, "role">> = {
  OWNER: { family: "role", tier: 5, Icon: Crown },
  ADMIN: { family: "role", tier: 4, Icon: ShieldCheck },
  MODERATOR: { family: "role", tier: 3, Icon: Eye },
  EDITOR: { family: "role", tier: 2, Icon: BookOpen },
  MEMBER: { family: "role", tier: 1, Icon: UserRound },
  BANNED: { family: "role", tier: 1, Icon: ShieldCheck },
};

const contributionTiers = [5, 10, 25, 50, 100, 250] as const;

function contributionTier(slug: string) {
  const amount = Number(slug.match(/^captures-(\d+)$/)?.[1] ?? 0);
  const index = contributionTiers.findIndex((threshold) => amount <= threshold);
  return index >= 0 ? index + 1 : contributionTiers.length;
}

function levelTier(slug: string) {
  const level = Number(slug.match(/^level-(\d+)$/)?.[1] ?? 1);
  return Math.min(6, Math.max(1, Math.ceil(level / 3)));
}

function criteriaTier(criteria: BadgeDto["criteria"]) {
  const tier = Number(criteria?.tier);
  return Number.isFinite(tier) && tier > 0 ? Math.min(6, Math.max(1, tier)) : null;
}

export function badgeVisualFor({
  badge,
  role,
}: {
  badge?: BadgeVisualInput | null;
  role?: UserRole | string | null;
}): BadgeVisual {
  if (role && role in roleVisuals) {
    return { ...roleVisuals[role as UserRole], role: role as UserRole };
  }

  const slug = String(badge?.slug ?? "").toLocaleLowerCase("fr-FR");
  const category = String(badge?.category ?? "").toLocaleUpperCase("fr-FR");
  const configuredTier = criteriaTier(badge?.criteria);
  const configuredFamily = String(badge?.criteria?.family ?? "").toLocaleLowerCase("fr-FR");

  if (configuredFamily === "entry-contribution") {
    return {
      family: "contribution",
      tier: configuredTier ?? 1,
      Icon: BookOpen,
    };
  }

  if (slug.startsWith("role-")) {
    const roleKey = slug.replace("role-", "").toUpperCase() as UserRole;
    if (roleKey in roleVisuals) {
      return { ...roleVisuals[roleKey], role: roleKey };
    }
  }
  if (slug.startsWith("captures-")) {
    return {
      family: "contribution",
      tier: configuredTier ?? contributionTier(slug),
      Icon: BookOpen,
    };
  }
  if (category === "LEVEL" || slug.startsWith("level-")) {
    return { family: "level", tier: configuredTier ?? levelTier(slug), Icon: Sparkles };
  }
  if (category === "CONTEST" || slug.includes("contest")) {
    return { family: "contest", tier: 4, Icon: Trophy };
  }
  if (slug.includes("review")) {
    return { family: "review", tier: 1, Icon: MessageSquare };
  }
  if (category === "PARTNER" || slug === "partner") {
    return { family: "community", tier: 3, Icon: UserRound };
  }
  if (slug.includes("historic") || slug.includes("top-trainer")) {
    return { family: "special", tier: 5, Icon: Award };
  }
  return { family: "special", tier: 1, Icon: Medal };
}

function tierMarks(tier: number) {
  return Array.from({ length: Math.min(5, Math.max(1, tier)) }, (_, index) => <span key={index} />);
}

export function BadgeEmblem({
  badge,
  role,
  compact = false,
  size = "default",
  className = "",
  label,
}: {
  badge?: BadgeDto | null;
  role?: UserRole | string | null;
  compact?: boolean;
  size?: "inline" | "default" | "card";
  className?: string;
  label?: string;
}) {
  const visual = badgeVisualFor({ badge, role });
  const Icon = visual.Icon;
  const rarity = String(badge?.rarity ?? "COMMON").toLocaleLowerCase("fr-FR");
  const roleClass = visual.role ? ` badge-emblem--role-${visual.role.toLocaleLowerCase()}` : "";
  const classes = [
    "badge-emblem",
    `badge-emblem--${visual.family}`,
    `badge-emblem--tier-${visual.tier}`,
    `badge-emblem--${rarity}`,
    `badge-emblem--${size}`,
    roleClass,
    compact ? "badge-emblem--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-label={label} role={label ? "img" : undefined} title={label}>
      <span className="badge-emblem__mark" aria-hidden="true">
        <Icon strokeWidth={2.4} />
      </span>
      <span className="badge-emblem__tier" aria-hidden="true">
        {tierMarks(visual.tier)}
      </span>
    </span>
  );
}
