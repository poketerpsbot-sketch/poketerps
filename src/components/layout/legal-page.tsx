import type { ReactNode } from "react";
import Link from "next/link";

const legalLinks = [
  { href: "/a-propos", label: "À propos" },
  { href: "/reglement", label: "Règlement" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/avertissements", label: "Avertissements" },
] as const;

export function LegalPage({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell legal-layout">
      <nav className="legal-nav" aria-label="Informations et règles">
        {legalLinks.map((item) => (
          <Link href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <article className="prose">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </article>
    </div>
  );
}
