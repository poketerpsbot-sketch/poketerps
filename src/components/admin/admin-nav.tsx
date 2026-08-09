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
  MessageSquare,
  Plus,
  ScrollText,
  Send,
  Settings,
  Tags,
  Users,
} from "lucide-react";

const links = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/fiches", label: "Fiches à valider", icon: BookOpen },
  { href: "/admin/avis", label: "Avis à valider", icon: MessageSquare },
  { href: "/admin/messages", label: "Messages & signalements", icon: Mail },
  { href: "/admin/categories", label: "Catégories", icon: Tags },
  { href: "/admin/publications", label: "Publications", icon: Send },
  { href: "/admin/utilisateurs", label: "Utilisateurs & équipe", icon: Users },
  { href: "/admin/badges", label: "Badges", icon: Award },
  { href: "/admin/partenaires", label: "Partenaires", icon: Handshake },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
  { href: "/admin/journal", label: "Journal", icon: ScrollText },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
  { href: "/capturer", label: "Ajouter une fiche", icon: Plus },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Administration">
      {links.map(({ href, label, icon: Icon }) => {
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
