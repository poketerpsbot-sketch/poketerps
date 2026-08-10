import Link from "next/link";
import { Award, Crown, Medal, Trophy } from "lucide-react";

import type { ContestLeaderboardItem, ContestWinner } from "@/components/contests/types";
import { jsonSummary } from "@/components/contests/contest-utils";
import { EmptyState } from "@/components/ui/states";

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("fr-FR");
}

export function ContestWinners({ winners }: { winners: ContestWinner[] }) {
  if (!winners.length) return null;
  return (
    <section className="content-panel contest-winners" aria-labelledby="contest-winners-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Palmarès officiel</p>
          <h2 id="contest-winners-title">Gagnants</h2>
        </div>
        <Crown aria-hidden="true" />
      </header>
      <div className="contest-winners__grid">
        {winners.map((winner) => (
          <article key={winner.id}>
            <span className="contest-winners__rank">#{winner.rank}</span>
            <span className="avatar" aria-hidden="true">
              {initials(winner.participant.displayName)}
            </span>
            <div>
              <Link href={`/profil/${encodeURIComponent(winner.participant.publicSlug)}`}>
                {winner.participant.displayName}
              </Link>
              <p>{winner.label ?? jsonSummary(winner.prize, "Prix du concours")}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContestLeaderboard({ items }: { items: ContestLeaderboardItem[] }) {
  return (
    <section className="content-panel contest-leaderboard" aria-labelledby="contest-rank-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Compétition communautaire</p>
          <h2 id="contest-rank-title">Classement</h2>
          <p>Seules les participations approuvées apparaissent ici.</p>
        </div>
        <Trophy aria-hidden="true" />
      </header>
      {items.length ? (
        <ol>
          {items.map((item) => (
            <li key={`${item.participant.id}-${item.entry?.id ?? "profile"}`}>
              <span className={`contest-leaderboard__rank rank-${Math.min(item.rank, 4)}`}>
                {item.rank === 1 ? (
                  <Crown aria-label="Premier" />
                ) : item.rank <= 3 ? (
                  <Medal aria-hidden="true" />
                ) : (
                  <Award aria-hidden="true" />
                )}
                <strong>#{item.rank}</strong>
              </span>
              <span className="avatar" aria-hidden="true">
                {initials(item.participant.displayName)}
              </span>
              <div className="contest-leaderboard__identity">
                <Link href={`/profil/${encodeURIComponent(item.participant.publicSlug)}`}>
                  {item.participant.displayName}
                </Link>
                {item.entry && (
                  <Link href={`/fiches/${encodeURIComponent(item.entry.slug)}`}>
                    {item.entry.name}
                  </Link>
                )}
              </div>
              <div className="contest-leaderboard__score">
                <strong>{item.score.toLocaleString("fr-CH", { maximumFractionDigits: 2 })}</strong>
                <span>points</span>
              </div>
              {item.isWinner && <span className="contest-leaderboard__winner">Gagnant</span>}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Le classement attend ses Dresseurs"
          description="Les participations approuvées apparaîtront ici dès le début de la compétition."
        />
      )}
    </section>
  );
}
