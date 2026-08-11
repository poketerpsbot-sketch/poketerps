import type {
  AdminContest,
  ContestFormValue,
  ContestPhase,
  ContestScoringMode,
  ContestStatus,
} from "@/components/contests/types";

export const phaseLabels: Record<ContestPhase, string> = {
  UPCOMING: "À venir",
  ACTIVE: "En cours",
  ENDED: "Terminé",
};

export const contestStatusLabels: Record<ContestStatus, string> = {
  DRAFT: "Brouillon",
  UPCOMING: "À venir",
  OPEN: "Inscriptions ouvertes",
  FULL: "Complet",
  CLOSED: "Inscriptions fermées",
  SCHEDULED: "Programmé",
  ACTIVE: "Actif",
  PAUSED: "En pause",
  ENDED: "Terminé",
  CANCELLED: "Annulé",
  ENDED_PENDING_RESULT: "Terminé · résultat à publier",
};

export const scoringLabels: Record<ContestScoringMode, string> = {
  MANUAL: "Note attribuée par l’équipe",
  ENTRY_LIKES: "Nombre de J’aime",
  ENTRY_VIEWS: "Nombre de vues",
  ENTRY_FAVORITES: "Nombre de favoris",
  ENTRY_RATING: "Note moyenne de la fiche",
  COMPOSITE: "Score combiné",
};

export function safeContestImage(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function formatContestDate(value: string | Date, timeZone = "Europe/Zurich") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date à confirmer";
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function formatContestPeriod(startsAt: string | Date, endsAt: string | Date) {
  return `Du ${formatContestDate(startsAt)} au ${formatContestDate(endsAt)}`;
}

export function jsonSummary(value: Record<string, unknown>, empty = "À annoncer") {
  const preferred = ["title", "name", "label", "description", "prize"];
  for (const key of preferred) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  const entries = Object.entries(value)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 3);
  if (!entries.length) return empty;
  return entries.map(([key, item]) => `${key}: ${String(item)}`).join(" · ");
}

export function adminContestValue(contest: AdminContest): ContestFormValue {
  const maximum = contest.maxParticipants ?? contest.max_participants;
  return {
    slug: contest.slug,
    title: contest.title,
    summary: contest.summary,
    description: contest.description,
    rules: contest.rules,
    imageUrl: contest.imageUrl ?? contest.image_url ?? null,
    status: contest.status,
    isFeatured: contest.isFeatured ?? contest.is_featured ?? false,
    startsAt: contest.startsAt ?? contest.starts_at ?? "",
    endsAt: contest.endsAt ?? contest.ends_at ?? "",
    scoringMode: contest.scoringMode ?? contest.scoring_mode ?? "MANUAL",
    criteria: contest.criteria ?? {},
    reward: contest.reward ?? {},
    rewardBadgeId: contest.rewardBadgeId ?? contest.reward_badge_id ?? null,
    maxParticipants: maximum === null || maximum === undefined ? null : Number(maximum),
    requireEntry: contest.requireEntry ?? contest.require_entry ?? false,
    contestType: contest.contestType ?? contest.contest_type ?? "OTHER",
    instructions: contest.instructions ?? "",
    participationSteps: contest.participationSteps ?? contest.participation_steps ?? [],
    externalUrl: contest.externalUrl ?? contest.external_url ?? null,
    telegramUrl: contest.telegramUrl ?? contest.telegram_url ?? null,
    instagramUrl: contest.instagramUrl ?? contest.instagram_url ?? null,
    terms: contest.terms ?? null,
    additionalInformation: contest.additionalInformation ?? contest.additional_information ?? null,
    registrationsOpen: contest.registrationsOpen ?? contest.registrations_open ?? true,
    registrationStartsAt: contest.registrationStartsAt ?? contest.registration_starts_at ?? null,
    registrationEndsAt: contest.registrationEndsAt ?? contest.registration_ends_at ?? null,
    shortDescription: contest.shortDescription ?? contest.summary ?? null,
    publicIntro: contest.publicIntro ?? contest.description ?? null,
    participantInstructions: contest.participantInstructions ?? contest.instructions ?? null,
    shortRules: contest.shortRules ?? null,
    fullRules: contest.fullRules ?? contest.rules ?? null,
    longDescription: contest.longDescription ?? contest.description ?? null,
    mainImageUrl: contest.mainImageUrl ?? contest.imageUrl ?? contest.image_url ?? null,
    resultImageUrl: contest.resultImageUrl ?? null,
    resultText: contest.resultText ?? null,
    registrationsManuallyClosed: contest.registrationsManuallyClosed ?? false,
    resultPublicationMode: contest.resultPublicationMode ?? "MANUAL",
    resultPublishedAt: contest.resultPublishedAt ?? null,
    secretWeight:
      contest.secretWeight === null || contest.secretWeight === undefined
        ? null
        : Number(contest.secretWeight),
    weightUnit: contest.weightUnit ?? null,
    customWeightUnit: contest.customWeightUnit ?? null,
    allowGuessEditing: contest.allowGuessEditing ?? false,
    tieBreakerMode: contest.tieBreakerMode ?? "MANUAL",
    notifyTelegramOnPublish: contest.notifyTelegramOnPublish ?? false,
    notifyParticipantsOnResult: contest.notifyParticipantsOnResult ?? false,
    links: contest.links ?? [],
  };
}

export function readApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  if (record.error && typeof record.error === "object") {
    const message = (record.error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export function localDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
