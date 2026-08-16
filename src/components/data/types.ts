export type Identifier = string | number;

export type MicronPresetDto = {
  id: Identifier;
  slug: string;
  context: "COLLECTION_SEPARATION" | "PRESSING_BAG";
  mode: "NONE" | "SINGLE" | "RANGE" | "MULTIPLE" | "FULL_SPECTRUM" | "MIXED";
  label: string;
  technicalName?: string | null;
  displayName?: string | null;
  frenchExplanation?: string | null;
  singleValue?: number | null;
  minimumValue?: number | null;
  maximumValue?: number | null;
  multipleValues?: number[] | null;
  isFullSpectrum?: boolean;
  isMixedMicron?: boolean;
  sortOrder?: number | null;
};

export type CategoryRef = {
  id?: Identifier;
  name: string;
  slug?: string;
  icon?: string | null;
  description?: string | null;
  technicalName?: string | null;
  displayName?: string | null;
  frenchExplanation?: string | null;
  micronRequirement?: "ABSENT" | "OPTIONAL" | "REQUIRED" | null;
  allowedMicronContexts?: Array<"COLLECTION_SEPARATION" | "PRESSING_BAG">;
  micronPresets?: MicronPresetDto[];
};

export type EntryImageDto = {
  id?: Identifier;
  url: string;
  alt?: string | null;
  altText?: string | null;
  isPrimary?: boolean;
  sourceUrl?: string | null;
  credit?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
};

export type AromaDto = {
  id: Identifier;
  familyId: Identifier;
  slug: string;
  name: string;
  synonyms?: string[];
  sortOrder?: number;
};

export type AromaFamilyDto = {
  id: Identifier;
  slug: string;
  name: string;
  sortOrder?: number;
  aromas: AromaDto[];
};

export type EntryAromaDto = AromaDto & {
  familyName: string;
  importance: "PRIMARY" | "SECONDARY";
  customLabel?: string | null;
};

export type EntrySummaryDto = {
  id: Identifier;
  slug: string;
  publicNumber?: number | string | null;
  name: string;
  shortDescription?: string | null;
  category?: CategoryRef | null;
  categoryName?: string | null;
  subcategory?: CategoryRef | null;
  status?: string | null;
  averageRating?: number | string | null;
  reviewCount?: number | null;
  viewCount?: number | null;
  likeCount?: number | null;
  favoriteCount?: number | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  primaryImageUrl?: string | null;
  images?: EntryImageDto[];
  contributor?: PublicProfileDto | null;
  author?: PublicProfileDto | null;
  tags?: Array<{ id?: Identifier; name: string; slug?: string }>;
  metricValue?: number | string | null;
  likedAt?: string | null;
  favoritedAt?: string | null;
  viewedAt?: string | null;
};

export type DynamicFieldValueDto = {
  id?: Identifier;
  label: string;
  value: string | number | string[] | null;
  unit?: string | null;
};

export type DynamicFieldOptionDto = {
  id?: Identifier;
  value: string;
  label: string;
  sortOrder?: number | null;
};

export type DynamicFieldDefinitionDto = {
  id: Identifier;
  key?: string;
  label: string;
  fieldType:
    | "TEXT"
    | "LONG_TEXT"
    | "NUMBER"
    | "BOOLEAN"
    | "SELECT"
    | "MULTISELECT"
    | "MULTI_SELECT"
    | "URL"
    | "DATE";
  helpText?: string | null;
  unit?: string | null;
  placeholder?: string | null;
  isRequired?: boolean;
  validation?: Record<string, unknown> | null;
  options?: DynamicFieldOptionDto[];
};

export type MicronSpecificationDto = {
  mode?: "NONE" | "SINGLE" | "RANGE" | "MULTIPLE" | "FULL_SPECTRUM" | "MIXED";
  singleValue?: number | null;
  minimumValue?: number | null;
  maximumValue?: number | null;
  multipleValues?: number[] | null;
  displayLabel?: string | null;
  sourceType?: string | null;
  notes?: string | null;
};

export type MicronContextDto = MicronSpecificationDto & {
  context: "COLLECTION_SEPARATION" | "PRESSING_BAG";
};

export type EntryDetailDto = EntrySummaryDto & {
  fullDescription?: string | null;
  rarity?: string | null;
  micronMin?: number | null;
  micronMax?: number | null;
  micronLabel?: string | null;
  fieldValues?: DynamicFieldValueDto[];
  fields?: Record<string, unknown>;
  micron?: MicronSpecificationDto | null;
  micronContexts?: MicronContextDto[];
  aromas?: EntryAromaDto[];
  isLiked?: boolean;
  isFavorited?: boolean;
  canReview?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CategoryDto = CategoryRef & {
  id: Identifier;
  entryCount?: number | null;
  isActive?: boolean;
  subcategories?: CategoryDto[];
  fields?: DynamicFieldDefinitionDto[];
};

export type BadgeDto = {
  id?: Identifier;
  name: string;
  icon?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  rarity?: string | null;
  xpReward?: number | null;
  description?: string | null;
  slug?: string | null;
  kind?: string | null;
  awardedAt?: string | null;
  activeUntil?: string | null;
};

export type PublicProfileDto = {
  id?: Identifier;
  publicSlug?: string;
  slug?: string;
  displayName: string;
  telegramUsername?: string | null;
  username?: string | null;
  profilePhotoUrl?: string | null;
  profileTitle?: string | null;
  title?: string | null;
  bio?: string | null;
  role?: string | null;
  level?: number | null;
  experiencePoints?: number | null;
  captureCount?: number | null;
  rankOverall?: number | null;
  rankMonth?: number | null;
  rankWeek?: number | null;
  ranks?: {
    allRank?: number | null;
    monthRank?: number | null;
    weekRank?: number | null;
    totalCaptures?: number | null;
  } | null;
  profileVisibility?: string | null;
  createdAt?: string | null;
  badges?: BadgeDto[];
  featuredEntry?: EntrySummaryDto | null;
};

export type TrainerRankingDto = {
  rank: number;
  captures: number;
  userId?: Identifier;
  periodCaptures?: number | null;
  totalCaptures?: number | null;
  likesReceived?: number | null;
  totalLikesReceived?: number | null;
  viewsReceived?: number | null;
  totalViewsReceived?: number | null;
  level?: number | null;
  experiencePoints?: number | null;
  profilePhotoUrl?: string | null;
  profileTitle?: string | null;
  user?: PublicProfileDto;
  profile?: PublicProfileDto;
  displayName?: string;
  publicSlug?: string;
  slug?: string;
  telegramUsername?: string | null;
  username?: string | null;
  badge?: BadgeDto | null;
};

export type EntryRankingDto = {
  rank: number;
  value?: number | string | null;
  entry: EntrySummaryDto;
};

export type ReviewDto = {
  id: Identifier;
  entryId?: Identifier;
  entryName?: string | null;
  content: string;
  overallRating: number | string;
  status?: string | null;
  moderationReason?: string | null;
  authorDisplayNameSnapshot?: string | null;
  authorUsernameSnapshot?: string | null;
  author?: PublicProfileDto | null;
  entry?: EntrySummaryDto | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  entrySlug?: string | null;
  ratings?: Array<{
    criterionId: Identifier;
    key?: string | null;
    label: string;
    score: number | string;
  }>;
  moderationHistory?: ReviewModerationEventDto[];
};

export type ReviewModerationEventDto = {
  id: Identifier;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  message?: string | null;
  admin?: PublicProfileDto | null;
  user?: PublicProfileDto | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
};

export type UserNotificationDto = {
  id: Identifier;
  type: string;
  title: string;
  message: string;
  relatedReviewId?: Identifier | null;
  relatedEntryId?: Identifier | null;
  relatedContestId?: Identifier | null;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt?: string | null;
  entry?: EntrySummaryDto | null;
};

export type ExperienceOverviewDto = {
  progress: {
    level: number;
    title: string;
    experiencePoints: number;
    currentThreshold: number;
    nextThreshold: number;
    remaining: number;
    percent: number;
  };
  events?: Array<{
    id: Identifier;
    points: number;
    reason: string;
    sourceType?: string | null;
    sourceId?: Identifier | null;
    createdAt?: string | null;
  }>;
  rules?: Array<{ key: string; label: string; points: number }>;
  levels?: Array<{ level: number; threshold: number; title: string }>;
};

export type SubmissionDto = {
  id: Identifier;
  type?: string | null;
  status: string;
  title?: string | null;
  entryName?: string | null;
  entry?: EntrySummaryDto | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  moderationReason?: string | null;
  entrySlug?: string | null;
  submittedAt?: string | null;
  resolvedAt?: string | null;
};

export type PartnerDto = {
  id: Identifier;
  slug: string;
  name: string;
  description?: string | null;
  category?: CategoryRef | string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  websiteUrl?: string | null;
  telegramUrl?: string | null;
  instagramUrl?: string | null;
  otherUrl?: string | null;
  isFeatured?: boolean;
  isActive?: boolean;
};

export type HomeDto = {
  availability?: Partial<
    Record<
      | "viewer"
      | "latest"
      | "trending"
      | "trainers"
      | "partners"
      | "configuration"
      | "contests"
      | "sinceLastVisit",
      boolean
    >
  >;
  sinceLastVisit?: {
    previousEnd?: string | null;
    newEntries: number;
    newContests: number;
    approvedReviews: number;
    xpGained: number;
  } | null;
  viewer?:
    | (PublicProfileDto & {
        progress?: {
          currentThreshold: number;
          nextThreshold: number;
          remaining: number;
          percent: number;
        };
      })
    | null;
  dailyDiscovery?: EntrySummaryDto | null;
  trendingEntries?: EntrySummaryDto[];
  activeContest?: {
    id: Identifier;
    slug: string;
    title: string;
    summary?: string | null;
    remainingParticipants?: number | null;
    maxParticipants?: number | null;
  } | null;
  publishedEntryCount?: number;
  latestEntries?: EntrySummaryDto[];
  latest?: EntrySummaryDto[];
  popularEntries?: EntrySummaryDto[];
  mostViewedEntries?: EntrySummaryDto[];
  mostViewed?: EntrySummaryDto[];
  mostLikedEntries?: EntrySummaryDto[];
  mostLiked?: EntrySummaryDto[];
  topRatedEntries?: EntrySummaryDto[];
  bestRated?: EntrySummaryDto[];
  categories?: CategoryDto[];
  topTrainers?: TrainerRankingDto[];
  featuredPartner?: PartnerDto | null;
  featuredPartners?: PartnerDto[];
  partners?: PartnerDto[];
  recentContributors?: PublicProfileDto[];
  socialLinks?: {
    telegramChannel?: string | null;
    telegramChat?: string | null;
    instagram?: string | null;
  };
};

export type AdminStatDto = {
  key?: string;
  label: string;
  value: number | string;
  change?: number | string | null;
};

export type AdminDashboardDto = {
  stats?: AdminStatDto[];
  publishedEntries?: number;
  pendingEntries?: number;
  pendingReviews?: number;
  openMessages?: number;
  activePartners?: number;
  members?: number;
  views30d?: number;
};

export type AdminMessageDto = {
  id: Identifier;
  type?: string | null;
  subject: string;
  content?: string | null;
  status: string;
  priority?: string | null;
  authorDisplayName?: string | null;
  authorUsername?: string | null;
  authorDisplayNameSnapshot?: string | null;
  authorUsernameSnapshot?: string | null;
  createdAt?: string | null;
  attachments?: Array<{
    id: Identifier;
    mimeType: string;
    byteSize: number;
    signedUrl: string | null;
    signedUrlExpiresInSeconds: number;
    createdAt?: string | null;
  }>;
};

export type PaginatedDto<T> = {
  items: T[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
};

export type ApiEnvelope<T> = {
  data?: T;
  items?: T extends Array<infer Item> ? Item[] : never;
  error?: string | { message?: string } | null;
  message?: string;
  pagination?: Omit<PaginatedDto<never>, "items">;
};
