import type { UserRole } from "@/lib/db/schema";

export type AdminUserIdentity = {
  id: string;
  displayName: string;
  publicSlug: string | null;
  telegramUsername: string | null;
  telegramId?: number | null;
  profilePhotoUrl: string | null;
  role: UserRole;
  isSystem: boolean;
  isBanned: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  suspensionUntil: string | null;
  createdAt: string;
  firstInteractionAt: string;
  appointedAt: string;
  lastSeenAt: string | null;
  level: number;
  experiencePoints: number;
};

export type UserActivityStats = {
  sessions7d: number;
  sessions30d: number;
  sessionsTotal: number;
  sessionDurationTotalSeconds: number;
  sessionDurationAverageSeconds: number;
  sessionPlatforms: Array<{
    platform: UserSessionDto["platform"];
    sessions: number;
    durationSeconds: number;
  }>;
  activeDays7d: number;
  activeDays30d: number;
  actions7d: number;
  actions30d: number;
  entriesCreated: number;
  entriesSubmitted: number;
  entriesApproved: number;
  entriesRejected: number;
  reviewsSubmitted: number;
  reviewsApproved: number;
  reviewsRejected: number;
  likesGiven: number;
  likesReceived: number;
  favoritesSaved: number;
  favoritesReceived: number;
  viewsReceived: number;
  messagesSent: number;
  reportsSent: number;
  contestParticipations: number;
  entriesModerated: number;
  reviewsModerated: number;
  contestsModerated: number;
  telegramMessagesSent: number;
  entryApprovals30d: number;
  entryRejections30d: number;
  reviewApprovals30d: number;
  reviewRejections30d: number;
  contestDecisions30d: number;
  sanctions30d: number;
};

export type UserRankingStats = {
  weekly: number | null;
  monthly: number | null;
  general: number | null;
  captures: number | null;
};

export type UserSessionDto = {
  id: string;
  platform: "MINI_APP" | "WEB" | "TELEGRAM_BOT" | "ADMIN_WEB" | "UNKNOWN";
  startedAt: string;
  lastActivityAt: string;
  endedAt: string | null;
  durationSeconds: number;
  appVersion: string | null;
  isCurrent?: boolean;
};

export type UserActivityDto = {
  id: string;
  eventType:
    | "APP_OPEN"
    | "ENTRY_VIEW"
    | "SEARCH"
    | "LIKE"
    | "UNLIKE"
    | "FAVORITE"
    | "REVIEW_SUBMIT"
    | "ENTRY_SUBMIT"
    | "PARTNER_VIEW"
    | "MESSAGE_SENT"
    | "CONTEST_JOIN";
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type UserInternalNoteDto = {
  id: string;
  content: string;
  adminId: string;
  adminName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserRoleHistoryDto = {
  id: string;
  previousRole: UserRole | null;
  newRole: UserRole;
  reason: string | null;
  changedById: string | null;
  changedByName: string | null;
  createdAt: string;
};

export type UserSanctionDto = {
  id: string;
  action: "WARNING" | "BAN" | "UNBAN";
  reason: string;
  startsAt: string;
  endsAt: string | null;
  adminId: string;
  adminName: string | null;
  previousRole: UserRole | null;
  createdAt: string;
};

export type TelegramDirectMessageDto = {
  id: string;
  text: string;
  status: "QUEUED" | "SENT" | "FAILED";
  telegramMessageId: number | null;
  errorMessage: string | null;
  adminId: string;
  adminName: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type TeamPermissionDto = {
  permissionCode: "VIEW_ADMIN_ACTIVITY" | "VIEW_MODERATOR_ACTIVITY" | "VIEW_TEAM_AUDIT_LOG";
  override: boolean | null;
  effective: boolean;
  expiresAt: string | null;
};

export type AdminUserDetailDto = {
  user: AdminUserIdentity;
  stats: UserActivityStats;
  rankings: UserRankingStats;
  sessions: UserSessionDto[];
  activity: UserActivityDto[];
  notes: UserInternalNoteDto[];
  roleHistory: UserRoleHistoryDto[];
  sanctions: UserSanctionDto[];
  telegramMessages: TelegramDirectMessageDto[];
  canManageAccount: boolean;
  canManageTeamPermissions: boolean;
  teamPermissions: TeamPermissionDto[];
};

export type TeamMemberActivityDto = {
  id: string;
  displayName: string;
  publicSlug: string | null;
  telegramUsername: string | null;
  profilePhotoUrl: string | null;
  role: UserRole;
  appointedAt: string;
  lastSeenAt: string | null;
  isActive7d: boolean;
  sessions7d: number;
  activeDays7d: number;
  actions7d: number;
  sessions30d: number;
  activeDays30d: number;
  actions30d: number;
  entriesModerated7d: number;
  reviewsModerated7d: number;
  messagesHandled7d: number;
  contestActions7d: number;
  telegramMessagesSent7d: number;
  entryApprovalsPeriod: number;
  entryRejectionsPeriod: number;
  reviewApprovalsPeriod: number;
  reviewRejectionsPeriod: number;
  contestDecisionsPeriod: number;
  sanctionsPeriod: number;
};

export type TeamActivitySummaryDto = {
  permissions: Record<
    "VIEW_ADMIN_ACTIVITY" | "VIEW_MODERATOR_ACTIVITY" | "VIEW_TEAM_AUDIT_LOG",
    boolean
  >;
  periodDays: number;
  activeStaff: number;
  activeStaff7d: number;
  activeAdmins7d: number;
  activeModerators7d: number;
  sessions: number;
  actions: number;
  actions30d: number;
  entriesModerated: number;
  reviewsModerated: number;
  messagesHandled: number;
  contestActions: number;
  telegramMessagesSent: number;
  members: TeamMemberActivityDto[];
  recentAudit: TeamAuditItemDto[];
};

export type TeamAuditItemDto = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: UserRole | null;
  action: string;
  entityType: string;
  entityId: string | null;
  source: string;
  requestId: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
};
