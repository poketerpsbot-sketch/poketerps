"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  Handshake,
  LayoutDashboard,
  Mail,
  Medal,
  MessageSquare,
  Plus,
  ScrollText,
  Send,
  Settings,
  Siren,
  Sparkles,
  Star,
  Tags,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/db/schema";
import type { AdminQueueCounts } from "@/lib/services/admin-queues";

const links = [
  {
    href: "/admin/moderation",
    label: "Vue modération",
    icon: LayoutDashboard,
    group: "À traiter",
  },
  { href: "/admin/fiches", label: "Fiches à valider", icon: BookOpen, group: "À traiter" },
  { href: "/admin/avis", label: "Avis à valider", icon: MessageSquare, group: "À traiter" },
  {
    href: "/admin/messages",
    label: "Messages & signalements",
    icon: Mail,
    group: "À traiter",
  },
  { href: "/admin/concours", label: "Concours", icon: Medal, group: "À traiter" },
  {
    href: "/admin",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    fullAdmin: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/fiches/gestion",
    label: "Gestion des fiches",
    icon: BookOpen,
    fullAdmin: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/categories",
    label: "Catégories",
    icon: Tags,
    fullAdmin: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/aromes",
    label: "Arômes",
    icon: Sparkles,
    fullAdmin: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/utilisateurs",
    label: "Utilisateurs & équipe",
    icon: Users,
    fullAdmin: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/equipe",
    label: "Équipe & activité",
    icon: Activity,
    teamActivity: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/partenaires",
    label: "Partenaires",
    icon: Handshake,
    fullAdmin: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/badges",
    label: "Badges",
    icon: Award,
    fullAdmin: true,
    group: "Gestion / modération",
  },
  {
    href: "/admin/publications",
    label: "Publications",
    icon: Send,
    fullAdmin: true,
    group: "Administration / outils",
  },
  {
    href: "/admin/experience",
    label: "XP & niveaux",
    icon: Star,
    ownerOnly: true,
    group: "Administration / outils",
  },
  {
    href: "/admin/systeme",
    label: "Santé système",
    icon: Siren,
    ownerOnly: true,
    group: "Administration / outils",
  },
  {
    href: "/admin/statistiques",
    label: "Statistiques",
    icon: BarChart3,
    fullAdmin: true,
    group: "Administration / outils",
  },
  {
    href: "/admin/journal",
    label: "Journal",
    icon: ScrollText,
    fullAdmin: true,
    group: "Administration / outils",
  },
  {
    href: "/admin/parametres",
    label: "Paramètres",
    icon: Settings,
    fullAdmin: true,
    group: "Administration / outils",
  },
  {
    href: "/capturer",
    label: "Ajouter une fiche",
    icon: Plus,
    fullAdmin: true,
    group: "Administration / outils",
  },
] as const;

export function AdminNav({
  role,
  canViewTeamActivity = role === "OWNER" || role === "ADMIN",
  queueCounts,
}: {
  role: UserRole;
  canViewTeamActivity?: boolean;
  queueCounts?: AdminQueueCounts;
}) {
  const pathname = usePathname();
  const fullAdmin = role === "OWNER" || role === "ADMIN";
  const visibleLinks = links.filter(
    (link) =>
      (!("fullAdmin" in link && link.fullAdmin) || fullAdmin) &&
      (!("ownerOnly" in link && link.ownerOnly) || role === "OWNER") &&
      (!("teamActivity" in link && link.teamActivity) || canViewTeamActivity),
  );

  const groups = [...new Set(visibleLinks.map((link) => link.group))];

  return (
    <nav className="admin-nav" aria-label="Administration">
      {groups.map((group) => (
        <div className="admin-nav__group" key={group}>
          <span className="admin-nav__label">{group}</span>
          {visibleLinks
            .filter((link) => link.group === group)
            .map(({ href, label, icon: Icon }) => {
              const active =
                href === "/admin"
                  ? pathname === href
                  : href === "/admin/fiches"
                    ? pathname === href
                    : pathname.startsWith(`${href}/`) || pathname === href;
              const count = queueCounts
                ? href === "/admin/moderation"
                  ? queueCounts.totalActionable
                  : href === "/admin/fiches"
                    ? queueCounts.pendingEntries + queueCounts.pendingCorrections
                    : href === "/admin/avis"
                      ? queueCounts.pendingReviews
                      : href === "/admin/messages"
                        ? queueCounts.pendingMessages + queueCounts.pendingReports
                        : href === "/admin/concours"
                          ? queueCounts.pendingContestParticipations
                          : 0
                : 0;
              return (
                <Link href={href} key={href} aria-current={active ? "page" : undefined}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className="admin-nav__count"
                      aria-label={`${count} élément${count > 1 ? "s" : ""} en attente`}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
