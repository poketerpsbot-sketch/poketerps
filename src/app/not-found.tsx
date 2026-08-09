import Link from "next/link";
import { Home, ScanSearch } from "lucide-react";

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found__panel">
        <span className="not-found__code">404</span>
        <div>
          <p className="eyebrow">Signal introuvable</p>
          <h1>Découverte non répertoriée</h1>
        </div>
        <p>
          Cette page a peut-être été déplacée, masquée ou n’a jamais été publiée dans les archives.
        </p>
        <div className="button-row">
          <Link className="button button--secondary" href="/">
            <Home size={17} aria-hidden="true" /> Accueil
          </Link>
          <Link className="button button--screen" href="/explorer">
            <ScanSearch size={17} aria-hidden="true" /> Explorer
          </Link>
        </div>
      </div>
    </div>
  );
}
