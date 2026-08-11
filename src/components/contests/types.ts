import type { EntrySummaryDto } from "@/components/data/types";

export type ContestPhase = "UPCOMING" | "ACTIVE" | "ENDED";
export type ContestStatus =
  | "DRAFT"
  | "UPCOMING"
  | "OPEN"
  | "FULL"
  | "CLOSED"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "ENDED"
  | "CANCELLED"
  | "ENDED_PENDING_RESULT";
export type ContestType =
  "GAME" | "DRAW" | "CREATIVE" | "ENTRY" | "EXTERNAL_LINK" | "COMMUNITY" | "OTHER" | "WEIGHT_GUESS";
export type ContestScoringMode =
  "MANUAL" | "ENTRY_LIKES" | "ENTRY_VIEWS" | "ENTRY_FAVORITES" | "ENTRY_RATING" | "COMPOSITE";
export type ContestParticipationStatus =
  "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "DISQUALIFIED";

export type ContestParticipant = {
  id: string;
  publicSlug: string;
  displayName: string;
  username: string | null;
  profilePhotoUrl: string | null;
};

export type ContestParticipation = {
  id: string;
  contestId: string;
  entryId: string | null;
  status: ContestParticipationStatus;
  statement: string | null;
  submittedAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
};

export type ContestWinner = {
  id: string;
  rank: number;
  label: string | null;
  prize: Record<string, unknown>;
  awardedAt: string;
  participant: ContestParticipant;
};

export type ContestCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  status: ContestStatus;
  effectiveStatus?: ContestStatus;
  effective_status?: ContestStatus;
  phase: ContestPhase;
  isFeatured: boolean;
  startsAt: string;
  endsAt: string;
  scoringMode: ContestScoringMode;
  reward: Record<string, unknown>;
  participantCount: number;
  maxParticipants: number | null;
  remainingParticipants: number | null;
  isFull: boolean;
  registrationsOpen: boolean;
  contestType: ContestType;
  participationOpen: boolean;
  timeZone?: string;
};

export type ContestLink = {
  id?: string;
  label: string;
  url: string;
  type: "WEBSITE" | "TELEGRAM" | "INSTAGRAM" | "OTHER";
  visibility: "PUBLIC" | "PARTICIPANTS_ONLY";
  displayOrder?: number;
};

export type ParticipantContestContent = {
  longDescription: string | null;
  instructions: string | null;
  participationSteps: string[];
  fullRules: string | null;
  terms: string | null;
  additionalInformation: string | null;
  links: ContestLink[];
  guess: { numericValue: number; unit: string; submittedAt: string; updatedAt: string } | null;
  allowGuessEditing: boolean;
};

export type ContestDetailData = ContestCardData & {
  publicIntro?: string | null;
  shortRules?: string | null;
  criteria: Record<string, unknown>;
  rewardBadge: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
  } | null;
  requireEntry: boolean;
  publicLinks?: ContestLink[];
  participantContent?: ParticipantContestContent | null;
  result?: {
    text: string | null;
    imageUrl: string | null;
    weight: number | null;
    weightUnit: string | null;
    publishedAt: string;
  } | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  winners: ContestWinner[];
  viewerParticipation: ContestParticipation | null;
  /** Legacy optional fields kept only for old serialized contests during migration. */
  description: string;
  rules: string;
  instructions: string;
  participationSteps: string[];
  externalUrl: string | null;
  telegramUrl: string | null;
  instagramUrl: string | null;
  terms: string | null;
  additionalInformation: string | null;
};

export type ContestLeaderboardItem = {
  rank: number;
  score: number;
  participant: ContestParticipant;
  entry: Pick<EntrySummaryDto, "id" | "slug" | "name" | "primaryImageUrl"> | null;
  submittedAt: string;
  isWinner: boolean;
  winner: {
    rank: number;
    label: string | null;
    prize: Record<string, unknown>;
  } | null;
};

export type AdminContest = {
  canManageWinner?: boolean;
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  rules: string;
  imageUrl: string | null;
  image_url?: string | null;
  status: ContestStatus;
  effectiveStatus?: ContestStatus;
  effective_status?: ContestStatus;
  isFeatured: boolean;
  is_featured?: boolean;
  startsAt: string;
  starts_at?: string;
  endsAt: string;
  ends_at?: string;
  scoringMode: ContestScoringMode;
  scoring_mode?: ContestScoringMode;
  criteria: Record<string, unknown>;
  reward: Record<string, unknown>;
  rewardBadgeId: string | null;
  reward_badge_id?: string | null;
  maxParticipants: number | null;
  max_participants?: number | string | null;
  requireEntry: boolean;
  require_entry?: boolean;
  contestType: ContestType;
  contest_type?: ContestType;
  shortDescription?: string | null;
  publicIntro?: string | null;
  participantInstructions?: string | null;
  shortRules?: string | null;
  fullRules?: string | null;
  longDescription?: string | null;
  mainImageUrl?: string | null;
  mainImageBucket?: "contest-images" | null;
  mainImagePath?: string | null;
  resultImageUrl?: string | null;
  resultImageBucket?: "contest-results" | null;
  resultImagePath?: string | null;
  resultText?: string | null;
  registrationsManuallyClosed?: boolean;
  resultPublicationMode?: "MANUAL" | "AUTOMATIC";
  resultPublishedAt?: string | null;
  secretWeight?: number | string | null;
  weightUnit?: "mg" | "g" | "kg" | "CUSTOM" | null;
  customWeightUnit?: string | null;
  allowGuessEditing?: boolean;
  tieBreakerMode?: "FIRST_SUBMISSION" | "RANDOM" | "MANUAL";
  notifyTelegramOnPublish?: boolean;
  notifyParticipantsOnResult?: boolean;
  links?: ContestLink[];
  analytics?: Record<string, number | null> | null;
  guessRanking?: Array<Record<string, unknown>>;
  winnerHistory?: Array<Record<string, unknown>>;
  instructions: string;
  participationSteps: string[];
  participation_steps?: string[];
  externalUrl: string | null;
  external_url?: string | null;
  telegramUrl: string | null;
  telegram_url?: string | null;
  instagramUrl: string | null;
  instagram_url?: string | null;
  terms: string | null;
  additionalInformation: string | null;
  additional_information?: string | null;
  registrationsOpen: boolean;
  registrations_open?: boolean;
  registrationStartsAt: string | null;
  registration_starts_at?: string | null;
  registrationEndsAt: string | null;
  registration_ends_at?: string | null;
  participantCount?: number;
  participation_count?: number | string;
  pendingCount?: number;
  pending_count?: number | string;
  approvedCount?: number;
  winners?: AdminContestWinner[];
};

export type AdminContestWinner = {
  id: string;
  contestId: string;
  participationId: string;
  rank: number;
  label: string | null;
  prize: Record<string, unknown>;
};

export type AdminContestParticipation = {
  id: string;
  contest_id?: string;
  contestId?: string;
  user_id?: string;
  entry_id?: string | null;
  entryId?: string | null;
  status: ContestParticipationStatus;
  statement: string | null;
  manual_score?: number | string;
  manualScore?: number | string;
  moderation_note?: string | null;
  moderationNote?: string | null;
  submitted_at?: string;
  submittedAt?: string;
  display_name?: string;
  public_slug?: string;
  telegram_username?: string | null;
  profile_photo_url?: string | null;
  role?: string;
  entry_slug?: string | null;
  entry_name?: string | null;
  entry_status?: string | null;
  winner_id?: string | null;
  winner_rank?: number | string | null;
  winner_label?: string | null;
};

export type ContestFormValue = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  rules: string;
  imageUrl: string | null;
  status: ContestStatus;
  isFeatured: boolean;
  startsAt: string;
  endsAt: string;
  scoringMode: ContestScoringMode;
  criteria: Record<string, unknown>;
  reward: Record<string, unknown>;
  rewardBadgeId: string | null;
  maxParticipants: number | null;
  requireEntry: boolean;
  contestType: ContestType;
  instructions: string;
  participationSteps: string[];
  externalUrl: string | null;
  telegramUrl: string | null;
  instagramUrl: string | null;
  terms: string | null;
  additionalInformation: string | null;
  registrationsOpen: boolean;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  shortDescription?: string | null;
  publicIntro?: string | null;
  participantInstructions?: string | null;
  shortRules?: string | null;
  fullRules?: string | null;
  longDescription?: string | null;
  mainImageUrl?: string | null;
  mainImageBucket?: "contest-images" | null;
  mainImagePath?: string | null;
  resultImageUrl?: string | null;
  resultImageBucket?: "contest-results" | null;
  resultImagePath?: string | null;
  resultText?: string | null;
  registrationsManuallyClosed?: boolean;
  resultPublicationMode?: "MANUAL" | "AUTOMATIC";
  resultPublishedAt?: string | null;
  secretWeight?: number | null;
  weightUnit?: "mg" | "g" | "kg" | "CUSTOM" | null;
  customWeightUnit?: string | null;
  allowGuessEditing?: boolean;
  tieBreakerMode?: "FIRST_SUBMISSION" | "RANDOM" | "MANUAL";
  notifyTelegramOnPublish?: boolean;
  notifyParticipantsOnResult?: boolean;
  links?: ContestLink[];
};
