import Link from "next/link";
import { CalendarDays, Medal, Sparkles, UsersRound } from "lucide-react";

import type { ContestCardData } from "@/components/contests/types";
import {
  formatContestPeriod,
  jsonSummary,
  phaseLabels,
  safeContestImage,
} from "@/components/contests/contest-utils";

export function ContestCard({ contest }: { contest: ContestCardData }) {
  const imageUrl = safeContestImage(contest.imageUrl);
  const places =
    contest.maxParticipants === null
      ? `${contest.participantCount} participant${contest.participantCount > 1 ? "s" : ""} · places illimitées`
      : `${contest.participantCount} / ${contest.maxParticipants} participants`;
  return (
    <article className={`contest-card contest-card--${contest.phase.toLowerCase()}`}>
      <Link href={`/concours/${encodeURIComponent(contest.slug)}`} className="contest-card__link">
        <div
          className={`contest-card__visual${imageUrl ? " contest-card__visual--image" : ""}`}
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
          role={imageUrl ? "img" : undefined}
          aria-label={imageUrl ? `Illustration du concours ${contest.title}` : undefined}
        >
          {!imageUrl && <Medal aria-hidden="true" />}
          <span className={`contest-phase contest-phase--${contest.phase.toLowerCase()}`}>
            {phaseLabels[contest.phase]}
          </span>
          {contest.isFeatured && (
            <span className="contest-featured">
              <Sparkles aria-hidden="true" /> À la une
            </span>
          )}
        </div>
        <div className="contest-card__body">
          <div>
            <h2>{contest.title}</h2>
            <p>{contest.summary}</p>
          </div>
          <dl className="contest-card__facts">
            <div>
              <dt>
                <CalendarDays aria-hidden="true" /> Période
              </dt>
              <dd>{formatContestPeriod(contest.startsAt, contest.endsAt)}</dd>
            </div>
            <div>
              <dt>
                <UsersRound aria-hidden="true" /> Participants
              </dt>
              <dd>{places}</dd>
            </div>
          </dl>
          {contest.remainingParticipants !== null &&
            contest.remainingParticipants > 0 &&
            contest.remainingParticipants <= 5 && (
              <p className="contest-card__urgency">
                🔥 Plus que {contest.remainingParticipants} place
                {contest.remainingParticipants > 1 ? "s" : ""}
              </p>
            )}
          {contest.isFull && <p className="contest-card__full">COMPLET</p>}
          <p className="contest-card__reward">
            <strong>Récompense</strong>
            <span>{jsonSummary(contest.reward)}</span>
          </p>
          <span className="button button--dark contest-card__action">
            {contest.isFull
              ? "Concours complet"
              : contest.participationOpen
                ? "Participer"
                : "Voir le concours"}
          </span>
        </div>
      </Link>
    </article>
  );
}
