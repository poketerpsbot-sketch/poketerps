import Link from "next/link";
import { Clock3, UsersRound } from "lucide-react";

import type { ContestPublicParticipant } from "@/components/contests/types";
import { UserAvatar } from "@/components/ui/user-avatar";

function identity(participant: ContestPublicParticipant) {
  return participant.username ? `@${participant.username}` : participant.displayName;
}

export function ContestParticipants({
  participants = [],
  resultPublished = false,
}: {
  participants?: ContestPublicParticipant[];
  resultPublished?: boolean;
}) {
  return (
    <section
      className="content-panel contest-participants"
      aria-labelledby="contest-participants-title"
    >
      <header className="section-heading">
        <div>
          <p className="eyebrow">Communauté</p>
          <h2 id="contest-participants-title">Participants</h2>
          <p>
            {resultPublished
              ? "Les réponses complètes sont visibles avec le résultat officiel."
              : "Les réponses restent partiellement masquées jusqu’à la publication du résultat."}
          </p>
        </div>
        <UsersRound aria-hidden="true" />
      </header>

      {participants.length === 0 ? (
        <p className="contest-participants__empty">Aucun participant inscrit pour le moment.</p>
      ) : (
        <ol className="contest-participants__list">
          {participants.map((participant, index) => (
            <li key={participant.id}>
              <span className="contest-participants__number" aria-hidden="true">
                {index + 1}
              </span>
              <Link
                className="contest-participants__identity"
                href={`/profil/${encodeURIComponent(participant.publicSlug)}`}
              >
                <UserAvatar
                  className="contest-participants__avatar"
                  displayName={participant.displayName}
                  src={participant.profilePhotoUrl}
                />
                <span>
                  <strong>{identity(participant)}</strong>
                  {participant.username && participant.displayName !== participant.username && (
                    <small>{participant.displayName}</small>
                  )}
                </span>
              </Link>
              <div className="contest-participants__responses">
                {participant.responses.length > 0 ? (
                  participant.responses.map((response, responseIndex) => (
                    <span key={`${participant.id}-${responseIndex}`}>
                      {participant.responses.length > 1 && (
                        <small>Réponse {responseIndex + 1}</small>
                      )}
                      {response}
                    </span>
                  ))
                ) : (
                  <span>Réponse en attente</span>
                )}
              </div>
              <time dateTime={String(participant.submittedAt)}>
                <Clock3 aria-hidden="true" />
                {new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit" }).format(
                  new Date(participant.submittedAt),
                )}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
