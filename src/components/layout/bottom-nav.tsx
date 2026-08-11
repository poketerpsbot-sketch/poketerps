"use client";

import Link from "next/link";
import { Handshake, Home, Medal, Plus, ScanSearch, Trophy, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Accueil", icon: Home, primary: false, matches: ["/"] },
    {
      href: "/explorer",
      label: "Explorer",
      icon: ScanSearch,
      primary: false,
      matches: ["/explorer", "/catalogue", "/recherche", "/categories", "/fiches"],
    },
    {
      href: "/concours",
      label: "Concours",
      icon: Medal,
      primary: false,
      matches: ["/concours"],
    },
    {
      href: "/capturer",
      label: "Ajouter",
      icon: Plus,
      primary: true,
      matches: ["/capturer"],
    },
    {
      href: "/classements",
      label: "Classement",
      icon: Trophy,
      primary: false,
      matches: ["/classements"],
    },
    {
      href: "/partenaires",
      label: "Partenaires",
      icon: Handshake,
      primary: false,
      matches: ["/partenaires"],
    },
    {
      href: "/profil",
      label: "Profil",
      icon: UserRound,
      primary: false,
      matches: ["/profil"],
    },
  ] as const;

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <div className="bottom-nav__inner">
        {items.map(({ href, label, icon: Icon, primary, matches }) => {
          const active = matches.some((match) =>
            match === "/" ? pathname === "/" : pathname.startsWith(match),
          );
          return (
            <Link
              href={href}
              key={href}
              className={`bottom-nav__item${active ? " is-active" : ""}${primary ? " bottom-nav__item--primary" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="bottom-nav__icon">
                <Icon aria-hidden="true" />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
