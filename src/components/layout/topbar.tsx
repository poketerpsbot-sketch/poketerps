import Link from "next/link";
import { Menu, Search, Trophy } from "lucide-react";
import { Brand } from "@/components/ui/brand";

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Navigation du site">
          <Link href="/explorer">Explorer</Link>
          <Link href="/classements">
            <Trophy size={16} aria-hidden="true" /> Classements
          </Link>
          <Link href="/partenaires">Partenaires</Link>
          <Link href="/a-propos">À propos</Link>
        </nav>
        <div className="topbar__actions">
          <Link className="icon-button" href="/recherche" aria-label="Rechercher">
            <Search aria-hidden="true" />
          </Link>
          <Link
            className="icon-button desktop-hidden"
            href="/profil"
            aria-label="Ouvrir le menu du profil"
          >
            <Menu aria-hidden="true" />
          </Link>
          <Link className="button button--dark topbar__capture" href="/capturer">
            <span aria-hidden="true">＋</span> Capturer
          </Link>
        </div>
      </div>
    </header>
  );
}
