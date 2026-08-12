import type { Metadata } from "next";
import { Medal, Trophy, UsersRound } from "lucide-react";

import { ContestCard } from "@/components/contests/contest-card";
import { ContestHallOfFame } from "@/components/contests/contest-hall-of-fame";
import type { ContestCardData } from "@/components/contests/types";
import { serverApi, unwrapList } from "@/components/data/server-api";
import { EmptyState, ErrorState } from "@/components/ui/states";

export const metadata: Metadata = {
  title: "Concours communautaires",
  description: "Défis, classements et récompenses de la communauté Pokédex.",
};

export default async function ContestsPage() {
  const result = await serverApi<unknown>("/api/contests?phase=all&limit=100&offset=0");
  const contests = unwrapList<ContestCardData>(result.data);
  const active = contests.filter((contest) => contest.phase === "ACTIVE");
  const upcoming = contests.filter((contest) => contest.phase === "UPCOMING");
  const ended = contests.filter((contest) => contest.phase === "ENDED");

  return (
    <div className="page-shell page-stack contests-page">
      <header className="page-header contests-header">
        <div className="page-header__copy">
          <p className="eyebrow">Arène communautaire</p>
          <h1 className="page-title">Concours</h1>
          <p>Relève des défis, présente tes meilleures fiches et grimpe au classement.</p>
        </div>
        <div className="contests-header__icons" aria-hidden="true">
          <Medal />
          <Trophy />
          <UsersRound />
        </div>
      </header>

      <ContestHallOfFame />

      {result.error ? (
        <ErrorState message={result.error} retryHref="/concours" />
      ) : !contests.length ? (
        <EmptyState
          title="Le prochain défi se prépare"
          description="L’équipe annoncera bientôt un concours. Reviens voir les règles et la récompense."
        />
      ) : (
        <>
          <ContestSection
            eyebrow="À toi de jouer"
            title="En cours"
            description="Les participations sont ouvertes pendant la période indiquée."
            contests={active}
          />
          <ContestSection
            eyebrow="Prépare ta capture"
            title="À venir"
            description="Découvre les prochains thèmes et prépare ta fiche à l’avance."
            contests={upcoming}
          />
          <ContestSection
            eyebrow="Archives de l’arène"
            title="Terminés"
            description="Consulte les classements et les gagnants des défis précédents."
            contests={ended}
          />
        </>
      )}
    </div>
  );
}

function ContestSection({
  eyebrow,
  title,
  description,
  contests,
}: {
  eyebrow: string;
  title: string;
  description: string;
  contests: ContestCardData[];
}) {
  if (!contests.length) return null;
  return (
    <section className="section-stack contests-section">
      <header className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="contest-grid">
        {contests.map((contest) => (
          <ContestCard contest={contest} key={contest.id} />
        ))}
      </div>
    </section>
  );
}
