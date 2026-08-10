import type { EntrySummaryDto } from "@/components/data/types";

export type ContestPhase = "UPCOMING" | "ACTIVE" | "ENDED";
export type ContestStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED" | "CANCELLED";
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
  phase: ContestPhase;
  isFeatured: boolean;
  startsAt: string;
  endsAt: string;
  scoringMode: ContestScoringMode;
  reward: Record<string, unknown>;
  participantCount: number;
  participationOpen: boolean;
};

export type ContestDetailData = ContestCardData & {
  description: string;
  rules: string;
  criteria: Record<string, unknown>;
  rewardBadge: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
  } | null;
  maxParticipants: number | null;
  requireEntry: boolean;
  winners: ContestWinner[];
  viewerParticipation: ContestParticipation | null;
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
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  rules: string;
  imageUrl: string | null;
  image_url?: string | null;
  status: ContestStatus;
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
};
