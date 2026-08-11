import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Medal,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  ExternalLink,
  Scale,
} from "lucide-react";

import { ContestLeaderboard, ContestWinners } from "@/components/contests/contest-leaderboard";
import { ContestParticipationPanel } from "@/components/contests/contest-participation";
import type { ContestDetailData, ContestLeaderboardItem } from "@/components/contests/types";
import {
  formatContestPeriod,
  jsonSummary,
  phaseLabels,
  safeContestImage,
  scoringLabels,
} from "@/components/contests/contest-utils";
import type { EntrySummaryDto } from "@/components/data/types";
import { serverApi, unwrapList, unwrapObject } from "@/components/data/server-api";
import { ErrorState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Détail du concours" };

export default async function ContestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const encodedSlug = encodeURIComponent(slug);
  const [contestResult, leaderboardResult, profileResult] = await Promise.all([
    serverApi<unknown>(`/api/contests/${encodedSlug}`),
    serverApi<unknown>(`/api/contests/${encodedSlug}/leaderboard?limit=100&offset=0`),
    serverApi<unknown>("/api/me"),
  ]);
  const contest = unwrapObject<ContestDetailData>(contestResult.data);
  const leaderboard = unwrapList<ContestLeaderboardItem>(leaderboardResult.data);
  const profile = unwrapObject<{ publishedEntries?: EntrySummaryDto[] }>(profileResult.data);

  if (contestResult.error || !contest) {
    return (
      <div className="page-shell">
        <ErrorState
          title="Concours introuvable"
          message={contestResult.error ?? "Ce concours n’est pas encore accessible."}
          retryHref="/concours"
        />
      </div>
    );
  }

  const imageUrl = safeContestImage(contest.imageUrl);
  return (
    <div className="page-shell page-stack contest-detail-page">
      <Link className="text-link contest-back-link" href="/concours">
        <ArrowLeft aria-hidden="true" /> Tous les concours
      </Link>

      <header className="contest-detail-hero">
        <div
          className={`contest-detail-hero__visual${imageUrl ? " contest-detail-hero__visual--image" : ""}`}
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
          role={imageUrl ? "img" : undefined}
          aria-label={imageUrl ? `Illustration du concours ${contest.title}` : undefined}
        >
          {!imageUrl && <Medal aria-hidden="true" />}
          <span className={`contest-phase contest-phase--${contest.phase.toLowerCase()}`}>
            {phaseLabels[contest.phase]}
          </span>
        </div>
        <div className="contest-detail-hero__copy">
          <p className="eyebrow">Défi communautaire</p>
          <h1>{contest.title}</h1>
          <p>{contest.summary}</p>
          <div className="contest-detail-hero__meta">
            <span>
              <CalendarDays aria-hidden="true" />{" "}
              {formatContestPeriod(contest.startsAt, contest.endsAt)}
            </span>
            <span>
              <UsersRound aria-hidden="true" /> {contest.participantCount}
              {contest.maxParticipants === null
                ? " participants · places illimitées"
                : ` / ${contest.maxParticipants} participants`}
            </span>
            <span>
              <Target aria-hidden="true" /> {scoringLabels[contest.scoringMode]}
            </span>
          </div>
        </div>
      </header>

      <div className="contest-detail-grid">
        <div className="page-stack">
          <section className="content-panel contest-prose">
            <p className="eyebrow">Présentation</p>
            <h2>Le défi</h2>
            <div className="contest-rich-text">
              {contest.publicIntro || contest.summary || "Les détails publics arrivent bientôt."}
            </div>
          </section>
          {(contest.shortRules || (contest.publicLinks?.length ?? 0) > 0) && (
            <section className="content-panel contest-prose">
              <p className="eyebrow">Avant de participer</p>
              <h2>Règles essentielles</h2>
              {contest.shortRules && <div className="contest-rich-text">{contest.shortRules}</div>}
              <div className="button-row">
                {(contest.publicLinks ?? []).map((link) =>
                  link.url ? (
                    <a
                      className="button button--secondary"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      key={`${link.type}-${link.url}`}
                    >
                      <ExternalLink aria-hidden="true" /> {link.label}
                    </a>
                  ) : null,
                )}
              </div>
            </section>
          )}
          {contest.result && (
            <section className="content-panel contest-prose">
              <p className="eyebrow">Résultat officiel</p>
              <h2>{contest.result.text || "Le résultat est publié"}</h2>
              {contest.result.weight !== null && (
                <p>
                  <Scale aria-hidden="true" /> Poids réel :{" "}
                  <strong>
                    {contest.result.weight} {contest.result.weightUnit}
                  </strong>
                </p>
              )}
              {contest.result.imageUrl && (
                <a
                  className="button button--secondary"
                  href={contest.result.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir la photo du résultat
                </a>
              )}
            </section>
          )}
        </div>
        <aside className="page-stack">
          <section className="content-panel contest-reward">
            <Sparkles aria-hidden="true" />
            <p className="eyebrow">Récompense</p>
            <h2>{jsonSummary(contest.reward)}</h2>
            {contest.rewardBadge && (
              <p className="contest-reward__badge">
                <span aria-hidden="true">{contest.rewardBadge.icon ?? "🏅"}</span>
                <strong>{contest.rewardBadge.name}</strong>
                {contest.rewardBadge.description && (
                  <small>{contest.rewardBadge.description}</small>
                )}
              </p>
            )}
          </section>
          <section className="content-panel contest-facts">
            <h2>
              <ShieldCheck aria-hidden="true" /> Conditions
            </h2>
            <dl>
              <div>
                <dt>Fiche obligatoire</dt>
                <dd>{contest.requireEntry ? "Oui" : "Non"}</dd>
              </div>
              <div>
                <dt>Places</dt>
                <dd>
                  {contest.maxParticipants === null
                    ? `${contest.participantCount} · illimitées`
                    : `${contest.participantCount} / ${contest.maxParticipants}`}
                </dd>
              </div>
              <div>
                <dt>Décompte</dt>
                <dd>{scoringLabels[contest.scoringMode]}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <ContestParticipationPanel
        initialContest={contest}
        initialEntries={profile?.publishedEntries ?? []}
        initiallyAuthenticated={!profileResult.error}
      />
      <ContestWinners winners={contest.winners} />
      <ContestLeaderboard items={leaderboard} />
    </div>
  );
}
