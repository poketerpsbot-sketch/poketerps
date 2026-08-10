import Link from "next/link";
import { Medal, Search, Trophy } from "lucide-react";
import { NavigationDrawer } from "@/components/layout/navigation-drawer";
import { Brand } from "@/components/ui/brand";

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Navigation du site">
          <Link href="/explorer">Explorer</Link>
          <Link href="/concours">
            <Medal size={16} aria-hidden="true" /> Concours
          </Link>
          <Link href="/classements">
            <Trophy size={16} aria-hidden="true" /> Classements
          </Link>
          <Link href="/partenaires">Partenaires</Link>
          <Link className="desktop-nav__optional" href="/a-propos">
            À propos
          </Link>
        </nav>
        <div className="topbar__actions">
          <Link className="icon-button" href="/recherche" aria-label="Rechercher">
            <Search aria-hidden="true" />
          </Link>
          <NavigationDrawer />
          <Link className="button button--dark topbar__capture" href="/capturer">
            <span aria-hidden="true">＋</span> Capturer
          </Link>
        </div>
      </div>
    </header>
  );
}
