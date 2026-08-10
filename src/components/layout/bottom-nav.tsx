"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Handshake, Home, Medal, Plus, ScanSearch, Trophy } from "lucide-react";
import { usePathname } from "next/navigation";

function sessionRole(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const user =
    data.user && typeof data.user === "object" ? (data.user as Record<string, unknown>) : data;
  return typeof user.role === "string" ? user.role : null;
}

export function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadRole = () => {
      void fetch("/api/auth/session", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return;
          setRole(sessionRole(await response.json().catch(() => null)));
        })
        .catch(() => undefined);
    };
    loadRole();
    window.addEventListener("pokedex:session-ready", loadRole);
    return () => {
      controller.abort();
      window.removeEventListener("pokedex:session-ready", loadRole);
    };
  }, []);

  const canManage = role === "EDITOR" || role === "ADMIN" || role === "OWNER";
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
      label: canManage ? "Ajouter" : "Proposer",
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
