import Link from "next/link";

const links = [
  { href: "/a-propos", label: "À propos" },
  { href: "/reglement", label: "Règlement" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/avertissements", label: "Avertissements" },
  { href: "/contact", label: "Contacter l’équipe" },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <p>
          <strong>Pokédex communautaire</strong>
          <span>Archive éditoriale sans vente ni mise en relation commerciale.</span>
        </p>
        <nav aria-label="Informations légales et contact">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
