import { CheckCircle2, Clock3, FilePenLine, RotateCcw, XCircle } from "lucide-react";

import type { ReviewModerationEventDto } from "@/components/data/types";
import { formatDate } from "@/components/ui/states";

const labels: Record<string, string> = {
  SUBMITTED: "Avis envoyé",
  CHANGES_REQUESTED: "Modification demandée",
  RESUBMITTED: "Avis corrigé et renvoyé",
  APPROVED: "Avis approuvé et publié",
  REJECTED: "Avis refusé",
  HIDDEN: "Avis masqué",
  RESTORED: "Avis restauré",
};

function EventIcon({ action }: { action: string }) {
  if (action === "APPROVED" || action === "RESTORED") return <CheckCircle2 aria-hidden="true" />;
  if (action === "REJECTED" || action === "HIDDEN") return <XCircle aria-hidden="true" />;
  if (action === "CHANGES_REQUESTED") return <FilePenLine aria-hidden="true" />;
  if (action === "RESUBMITTED") return <RotateCcw aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
}

export function ReviewHistory({ events }: { events: ReviewModerationEventDto[] }) {
  if (events.length === 0) return null;
  return (
    <section className="review-history" aria-label="Historique de modération">
      <h3>Historique de modération</h3>
      <ol>
        {[...events].reverse().map((event) => {
          const actor = event.admin ?? event.user;
          return (
            <li key={String(event.id)}>
              <span className="review-history__icon">
                <EventIcon action={event.action} />
              </span>
              <div>
                <strong>{labels[event.action] ?? event.action.replaceAll("_", " ")}</strong>
                {actor && (
                  <span> par {actor.username ? `@${actor.username}` : actor.displayName}</span>
                )}
                {event.message && <p>{event.message}</p>}
                <small>
                  {formatDate(event.createdAt)}
                  {event.resolvedAt ? " · demande clôturée" : ""}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
