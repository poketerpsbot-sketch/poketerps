"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  Handshake,
  Home,
  Info,
  LayoutDashboard,
  Mail,
  Medal,
  Menu,
  MessageSquare,
  Plus,
  ScanSearch,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Tags,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import { RoleBadge } from "@/components/ui/role-badge";
import {
  canAccessFullAdminConsole,
  canAccessModerationConsole,
  sessionIdentity,
  type SessionIdentity,
} from "@/lib/auth/ui-access";

const publicLinks = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/explorer", label: "Explorer", icon: ScanSearch },
  { href: "/concours", label: "Concours", icon: Medal },
  { href: "/classements", label: "Classements", icon: Trophy },
  { href: "/partenaires", label: "Partenaires", icon: Handshake },
  { href: "/a-propos", label: "À propos", icon: Info },
  { href: "/profil", label: "Mon profil", icon: UserRound },
] as const;

const moderationLinks = [
  { href: "/admin/moderation", label: "Vue Modération", icon: ShieldCheck },
  { href: "/admin/fiches", label: "Fiches à valider", icon: BookOpen },
  { href: "/admin/avis", label: "Avis à valider", icon: MessageSquare },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/concours", label: "Participants concours", icon: UsersRound },
] as const;

const administrationLinks = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/concours", label: "Gérer les concours", icon: Medal },
  { href: "/admin/categories", label: "Catégories", icon: Tags },
  { href: "/admin/publications", label: "Publications", icon: Send },
  { href: "/admin/utilisateurs", label: "Utilisateurs & équipe", icon: Users },
  { href: "/admin/badges", label: "Badges", icon: Award },
  { href: "/admin/partenaires", label: "Partenaires", icon: Handshake },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
  { href: "/admin/journal", label: "Journal", icon: ScrollText },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
] as const;

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

function DrawerLinks({
  links,
  close,
}: {
  links: ReadonlyArray<{ href: string; label: string; icon: typeof Home }>;
  close: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="nav-drawer__links">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            href={href}
            key={`${href}-${label}`}
            aria-current={active ? "page" : undefined}
            onClick={close}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function NavigationDrawer() {
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadSession = () => {
      void fetch("/api/auth/session", { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 401) setIdentity(null);
            return;
          }
          setIdentity(sessionIdentity(await response.json().catch(() => null)));
        })
        .catch(() => undefined);
    };
    loadSession();
    window.addEventListener("pokedex:session-ready", loadSession);
    return () => {
      controller.abort();
      window.removeEventListener("pokedex:session-ready", loadSession);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute("aria-hidden") !== "true");
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  const moderator = identity ? canAccessModerationConsole(identity.role) : false;
  const administrator = identity ? canAccessFullAdminConsole(identity.role) : false;

  return (
    <>
      <button
        ref={buttonRef}
        className="icon-button nav-drawer__trigger"
        type="button"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        aria-controls="site-navigation-drawer"
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden="true" />
      </button>
      <div className={`nav-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <button
          className="nav-drawer__backdrop"
          type="button"
          aria-label="Fermer le menu"
          onClick={close}
        />
        <aside
          ref={panelRef}
          id="site-navigation-drawer"
          className="nav-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="nav-drawer__header">
            <div>
              <p className="eyebrow">Navigation Pokédex</p>
              <h2 id={titleId}>Menu principal</h2>
            </div>
            <button
              ref={closeRef}
              className="icon-button"
              type="button"
              aria-label="Fermer le menu"
              onClick={() => {
                close();
                buttonRef.current?.focus();
              }}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <Link className="nav-drawer__identity" href="/profil" onClick={close}>
            <span className="avatar" aria-hidden="true">
              {identity ? initials(identity.displayName) : <UserRound />}
            </span>
            <span className="nav-drawer__identity-copy">
              <strong>{identity?.displayName ?? "Compte Telegram"}</strong>
              <span>{identity?.username ? `@${identity.username}` : "Ouvrir mon profil"}</span>
            </span>
            {identity && <RoleBadge role={identity.role} compact />}
          </Link>

          <nav className="nav-drawer__navigation" aria-label="Navigation du menu">
            <section>
              <h3>Navigation</h3>
              <DrawerLinks links={publicLinks} close={close} />
              <Link
                className="button button--dark nav-drawer__capture"
                href="/capturer"
                onClick={close}
              >
                <Plus aria-hidden="true" /> Proposer une capture
              </Link>
            </section>

            {moderator && (
              <section className="nav-drawer__staff-section">
                <h3>Modération</h3>
                <DrawerLinks links={moderationLinks} close={close} />
              </section>
            )}

            {administrator && (
              <section className="nav-drawer__staff-section">
                <h3>Administration</h3>
                <DrawerLinks links={administrationLinks} close={close} />
              </section>
            )}
          </nav>
        </aside>
      </div>
    </>
  );
}
