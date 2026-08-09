import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Pokédex — accueil">
      <span className="brand__lens" aria-hidden="true">
        <span />
      </span>
      <span className="brand__wordmark">
        <strong>POKÉDEX</strong>
        {!compact && <small>Archives communautaires</small>}
      </span>
    </Link>
  );
}

export function PokeballMark({ small = false }: { small?: boolean }) {
  return <span className={small ? "pokeball pokeball--small" : "pokeball"} aria-hidden="true" />;
}
