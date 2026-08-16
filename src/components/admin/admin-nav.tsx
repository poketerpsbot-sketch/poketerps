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
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, fullAdmin: true },
  { href: "/admin/moderation", label: "Vue modération", icon: LayoutDashboard },
  { href: "/admin/fiches", label: "Fiches à valider", icon: BookOpen },
  {
    href: "/admin/fiches/gestion",
    label: "Gestion des fiches",
    icon: BookOpen,
    fullAdmin: true,
  },
  { href: "/admin/avis", label: "Avis à valider", icon: MessageSquare },
  { href: "/admin/messages", label: "Messages & signalements", icon: Mail },
  { href: "/admin/concours", label: "Concours", icon: Medal },
  { href: "/admin/categories", label: "Catégories", icon: Tags, fullAdmin: true },
  { href: "/admin/aromes", label: "Arômes", icon: Sparkles, fullAdmin: true },
  { href: "/admin/publications", label: "Publications", icon: Send, fullAdmin: true },
  { href: "/admin/utilisateurs", label: "Utilisateurs & équipe", icon: Users, fullAdmin: true },
  { href: "/admin/equipe", label: "Équipe & activité", icon: Activity, teamActivity: true },
  { href: "/admin/badges", label: "Badges", icon: Award, fullAdmin: true },
  { href: "/admin/experience", label: "XP & niveaux", icon: Star, ownerOnly: true },
  { href: "/admin/systeme", label: "Santé système", icon: Siren, ownerOnly: true },
  { href: "/admin/partenaires", label: "Partenaires", icon: Handshake, fullAdmin: true },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3, fullAdmin: true },
  { href: "/admin/journal", label: "Journal", icon: ScrollText, fullAdmin: true },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings, fullAdmin: true },
  { href: "/capturer", label: "Ajouter une fiche", icon: Plus, fullAdmin: true },
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

  return (
    <nav className="admin-nav" aria-label="Administration">
      {visibleLinks.map(({ href, label, icon: Icon }) => {
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
    </nav>
  );
}
