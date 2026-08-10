"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  Tags,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/db/schema";

const links = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, fullAdmin: true },
  { href: "/admin/moderation", label: "Vue modération", icon: LayoutDashboard },
  { href: "/admin/fiches", label: "Fiches à valider", icon: BookOpen },
  { href: "/admin/avis", label: "Avis à valider", icon: MessageSquare },
  { href: "/admin/messages", label: "Messages & signalements", icon: Mail },
  { href: "/admin/concours", label: "Concours", icon: Medal },
  { href: "/admin/categories", label: "Catégories", icon: Tags, fullAdmin: true },
  { href: "/admin/publications", label: "Publications", icon: Send, fullAdmin: true },
  { href: "/admin/utilisateurs", label: "Utilisateurs & équipe", icon: Users, fullAdmin: true },
  { href: "/admin/badges", label: "Badges", icon: Award, fullAdmin: true },
  { href: "/admin/partenaires", label: "Partenaires", icon: Handshake, fullAdmin: true },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3, fullAdmin: true },
  { href: "/admin/journal", label: "Journal", icon: ScrollText, fullAdmin: true },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings, fullAdmin: true },
  { href: "/capturer", label: "Ajouter une fiche", icon: Plus, fullAdmin: true },
] as const;

export function AdminNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const fullAdmin = role === "OWNER" || role === "ADMIN";
  const visibleLinks = links.filter(
    (link) => !("fullAdmin" in link && link.fullAdmin) || fullAdmin,
  );

  return (
    <nav className="admin-nav" aria-label="Administration">
      {visibleLinks.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin"
            ? pathname === href
            : pathname.startsWith(`${href}/`) || pathname === href;
        return (
          <Link href={href} key={href} aria-current={active ? "page" : undefined}>
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
