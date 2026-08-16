export type ContestEffectiveStatus =
  "DRAFT" | "UPCOMING" | "OPEN" | "FULL" | "CLOSED" | "ENDED_PENDING_RESULT" | "ENDED";

export type ContestSchedule = {
  status?: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  registrationStartsAt?: Date | string | null;
  registrationEndsAt?: Date | string | null;
  registrationsOpen?: boolean;
  registrationsManuallyClosed?: boolean;
  maxParticipants?: number | null;
  participantCount?: number;
  resultPublishedAt?: Date | string | null;
};

export function effectiveContestDates(contest: ContestSchedule) {
  return {
    startsAt: new Date(contest.registrationStartsAt ?? contest.startsAt),
    endsAt: new Date(contest.registrationEndsAt ?? contest.endsAt),
  };
}

export function getContestEffectiveStatus(
  contest: ContestSchedule,
  now = new Date(),
): ContestEffectiveStatus {
  if (contest.status === "DRAFT") return "DRAFT";

  const dates = effectiveContestDates(contest);
  if (now >= dates.endsAt) {
    return contest.resultPublishedAt ? "ENDED" : "ENDED_PENDING_RESULT";
  }
  if (
    contest.status === "CANCELLED" ||
    contest.status === "PAUSED" ||
    contest.status === "CLOSED" ||
    contest.registrationsOpen === false ||
    contest.registrationsManuallyClosed
  ) {
    return "CLOSED";
  }
  if (now < dates.startsAt) return "UPCOMING";
  if (
    contest.maxParticipants !== null &&
    contest.maxParticipants !== undefined &&
    (contest.participantCount ?? 0) >= contest.maxParticipants
  ) {
    return "FULL";
  }
  return "OPEN";
}

export function contestParticipationError(status: ContestEffectiveStatus): {
  code: string;
  message: string;
} | null {
  switch (status) {
    case "OPEN":
      return null;
    case "UPCOMING":
      return { code: "CONTEST_UPCOMING", message: "Le concours n’a pas encore commencé." };
    case "FULL":
      return { code: "CONTEST_FULL", message: "Toutes les places sont prises." };
    case "ENDED":
    case "ENDED_PENDING_RESULT":
      return { code: "CONTEST_ENDED", message: "Ce concours est terminé." };
    case "DRAFT":
    case "CLOSED":
      return { code: "CONTEST_CLOSED", message: "Les inscriptions sont fermées." };
  }
}
