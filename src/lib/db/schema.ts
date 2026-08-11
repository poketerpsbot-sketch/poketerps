import { sql } from "drizzle-orm";
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const accountKindEnum = pgEnum("account_kind", ["TELEGRAM", "SYSTEM"]);
export const userRoleEnum = pgEnum("user_role", [
  "OWNER",
  "ADMIN",
  "MODERATOR",
  "EDITOR",
  "MEMBER",
  "BANNED",
]);
export const profileVisibilityEnum = pgEnum("profile_visibility", [
  "PUBLIC",
  "MEMBERS_ONLY",
  "PRIVATE",
]);
export const badgeKindEnum = pgEnum("badge_kind", ["ACTIVE", "HISTORICAL", "PERMANENT"]);
export const entryStatusEnum = pgEnum("entry_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN",
  "ARCHIVED",
  "DELETED",
]);
export const entryRarityEnum = pgEnum("entry_rarity", [
  "UNKNOWN",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
]);
export const entryImageKindEnum = pgEnum("entry_image_kind", [
  "PRIMARY",
  "GALLERY",
  "PACKAGING",
  "LAB_REPORT",
]);
export const dynamicFieldTypeEnum = pgEnum("dynamic_field_type", [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "DATE",
  "URL",
]);
export const taxonomyTargetTypeEnum = pgEnum("taxonomy_target_type", [
  "CATEGORY",
  "SUBCATEGORY",
  "TAG",
]);
export const micronModeEnum = pgEnum("micron_mode", [
  "NONE",
  "SINGLE",
  "RANGE",
  "MULTIPLE",
  "FULL_SPECTRUM",
  "MIXED",
]);
export const micronSourceEnum = pgEnum("micron_source_type", [
  "DECLARED",
  "LABEL",
  "PACKAGING",
  "LAB_REPORT",
  "COMMUNITY",
  "UNKNOWN",
]);
export const reviewStatusEnum = pgEnum("review_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN",
  "DELETED",
]);
export const submissionTypeEnum = pgEnum("submission_type", ["NEW_ENTRY", "CORRECTION"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export const messageTypeEnum = pgEnum("admin_message_type", [
  "IMPROVEMENT",
  "BUG",
  "REPORT",
  "OTHER",
]);
export const messageStatusEnum = pgEnum("admin_message_status", [
  "NEW",
  "READ",
  "IN_PROGRESS",
  "RESOLVED",
  "ARCHIVED",
  "REJECTED",
]);
export const priorityEnum = pgEnum("message_priority", ["LOW", "NORMAL", "HIGH", "URGENT"]);
export const problemTypeEnum = pgEnum("problem_type", [
  "BUG",
  "DISPLAY",
  "INCORRECT_ENTRY",
  "USER",
  "REVIEW",
  "IMAGE",
  "PARTNER",
  "NAVIGATION",
  "OTHER",
]);
export const reportTargetTypeEnum = pgEnum("report_target_type", [
  "ENTRY",
  "REVIEW",
  "USER",
  "IMAGE",
  "PARTNER",
  "OTHER",
]);
export const publicationTypeEnum = pgEnum("telegram_publication_type", [
  "ENTRY",
  "PARTNER",
  "ANNOUNCEMENT",
]);
export const publicationStatusEnum = pgEnum("telegram_publication_status", [
  "DRAFT",
  "PREVIEWED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
]);
export const settingValueTypeEnum = pgEnum("setting_value_type", [
  "STRING",
  "NUMBER",
  "BOOLEAN",
  "JSON",
  "URL",
]);
export const partnerCategoryKindEnum = pgEnum("partner_category_kind", [
  "COMMUNITY",
  "MEDIA",
  "CREATOR",
  "EVENT",
  "ASSOCIATION",
  "BRAND",
  "OTHER",
]);
export const partnershipTypeEnum = pgEnum("partnership_type", [
  "COMMUNITY",
  "OFFICIAL",
  "SPONSORED",
  "TEMPORARY",
  "PREMIUM",
]);
export const contestStatusEnum = pgEnum("contest_status", [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "ENDED",
  "CANCELLED",
  "UPCOMING",
  "OPEN",
  "FULL",
  "CLOSED",
  "ENDED_PENDING_RESULT",
]);
export const contestScoringModeEnum = pgEnum("contest_scoring_mode", [
  "MANUAL",
  "ENTRY_LIKES",
  "ENTRY_VIEWS",
  "ENTRY_FAVORITES",
  "ENTRY_RATING",
  "COMPOSITE",
]);
export const contestParticipationStatusEnum = pgEnum("contest_participation_status", [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "DISQUALIFIED",
]);
export const reviewModerationActionEnum = pgEnum("review_moderation_action", [
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
  "RESTORED",
  "DELETED",
]);
export const userNotificationTypeEnum = pgEnum("user_notification_type", [
  "REVIEW_APPROVED",
  "REVIEW_REJECTED",
  "REVIEW_CHANGES_REQUESTED",
  "REVIEW_RESUBMITTED",
  "ENTRY_APPROVED",
  "ENTRY_REJECTED",
  "CONTEST",
  "SYSTEM",
  "ENTRY_CHANGES_REQUESTED",
  "CONTEST_NEW",
  "CONTEST_RESULT",
  "CONTEST_WINNER",
]);
export const contestTypeEnum = pgEnum("contest_type", [
  "GAME",
  "DRAW",
  "CREATIVE",
  "ENTRY",
  "EXTERNAL_LINK",
  "COMMUNITY",
  "OTHER",
  "WEIGHT_GUESS",
]);
export const contestLinkTypeEnum = pgEnum("contest_link_type", [
  "WEBSITE",
  "TELEGRAM",
  "INSTAGRAM",
  "OTHER",
]);
export const contestLinkVisibilityEnum = pgEnum("contest_link_visibility", [
  "PUBLIC",
  "PARTICIPANTS_ONLY",
]);
export const contestTieBreakerModeEnum = pgEnum("contest_tie_breaker_mode", [
  "FIRST_SUBMISSION",
  "RANDOM",
  "MANUAL",
]);
export const contestResultPublicationModeEnum = pgEnum("contest_result_publication_mode", [
  "MANUAL",
  "AUTOMATIC",
]);
export const contestEventTypeEnum = pgEnum("contest_event_type", [
  "PAGE_VIEW",
  "JOIN_CLICK",
  "LINK_CLICK",
]);
export const contestWinnerHistoryActionEnum = pgEnum("contest_winner_history_action", [
  "SELECTED",
  "REPLACED",
  "REMOVED",
]);
export const telegramBroadcastTypeEnum = pgEnum("telegram_broadcast_type", [
  "CONTEST_NEW",
  "CONTEST_RESULT",
  "CONTEST_WINNER",
]);
export const telegramBroadcastStatusEnum = pgEnum("telegram_broadcast_status", [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
]);
export const telegramDeliveryStatusEnum = pgEnum("telegram_delivery_status", [
  "QUEUED",
  "SENT",
  "FAILED",
  "BLOCKED",
  "RETRY",
]);
export const userSessionPlatformEnum = pgEnum("user_session_platform", [
  "MINI_APP",
  "WEB",
  "TELEGRAM_BOT",
  "ADMIN_WEB",
  "UNKNOWN",
]);
export const userActivityEventTypeEnum = pgEnum("user_activity_event_type", [
  "APP_OPEN",
  "ENTRY_VIEW",
  "SEARCH",
  "LIKE",
  "UNLIKE",
  "FAVORITE",
  "REVIEW_SUBMIT",
  "ENTRY_SUBMIT",
  "PARTNER_VIEW",
  "MESSAGE_SENT",
  "CONTEST_JOIN",
]);
export const adminOutboundMessageStatusEnum = pgEnum("admin_outbound_message_status", [
  "QUEUED",
  "SENT",
  "FAILED",
]);
export const userModerationActionEnum = pgEnum("user_moderation_action", [
  "WARNING",
  "BAN",
  "UNBAN",
]);
export const micronContextTypeEnum = pgEnum("micron_context_type", [
  "COLLECTION_SEPARATION",
  "PRESSING_BAG",
]);
export const micronRequirementEnum = pgEnum("micron_requirement", [
  "ABSENT",
  "OPTIONAL",
  "REQUIRED",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountKind: accountKindEnum("account_kind").notNull().default("TELEGRAM"),
    isSystem: boolean("is_system").notNull().default(false),
    telegramId: bigint("telegram_id", { mode: "number" }).unique(),
    telegramUsername: text("telegram_username"),
    telegramUsernameSnapshot: text("telegram_username_snapshot"),
    displayName: text("display_name").notNull(),
    profilePhotoUrl: text("profile_photo_url"),
    publicSlug: text("public_slug").notNull().unique(),
    role: userRoleEnum("role").notNull().default("MEMBER"),
    profileTitle: text("profile_title"),
    bio: text("bio"),
    experiencePoints: bigint("experience_points", { mode: "number" }).notNull().default(0),
    level: integer("level").notNull().default(1),
    featuredEntryId: uuid("featured_entry_id").references((): AnyPgColumn => entries.id, {
      onDelete: "set null",
    }),
    profileVisibility: profileVisibilityEnum("profile_visibility").notNull().default("PUBLIC"),
    isBanned: boolean("is_banned").notNull().default(false),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
    bannedUntil: timestamp("banned_until", { withTimezone: true }),
    bannedById: uuid("banned_by_id").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    roleBeforeBan: userRoleEnum("role_before_ban"),
    ...timestamps,
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    index("users_telegram_username_idx").on(table.telegramUsername),
    index("users_role_idx").on(table.role),
    index("users_banned_until_idx")
      .on(table.bannedUntil)
      .where(sql`${table.isBanned} and ${table.bannedUntil} is not null`),
    check(
      "users_identity_consistency",
      sql`(${table.accountKind}='TELEGRAM' and not ${table.isSystem} and ${table.telegramId} is not null and ${table.telegramId}>0) or (${table.accountKind}='SYSTEM' and ${table.isSystem} and ${table.telegramId} is null)`,
    ),
  ],
);

export const userProfileSettings = pgTable("user_profile_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: text("locale").notNull().default("fr"),
  timezone: text("timezone").notNull().default("Europe/Zurich"),
  allowContact: boolean("allow_contact").notNull().default(true),
  showActivity: boolean("show_activity").notNull().default(true),
  showBadges: boolean("show_badges").notNull().default(true),
  ageGateConfirmedAt: timestamp("age_gate_confirmed_at", { withTimezone: true }),
  notifyReviewStatus: boolean("notify_review_status").notNull().default(true),
  notifySubmissionStatus: boolean("notify_submission_status").notNull().default(true),
  notifyContests: boolean("notify_contests").notNull().default(true),
  ...timestamps,
});

export const permissions = pgTable("permissions", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: userRoleEnum("role").notNull(),
    permissionCode: text("permission_code")
      .notNull()
      .references(() => permissions.code, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.role, table.permissionCode] }),
    index("role_permissions_permission_idx").on(table.permissionCode),
  ],
);

export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissionCode: text("permission_code")
      .notNull()
      .references(() => permissions.code, { onDelete: "cascade" }),
    isGranted: boolean("is_granted").notNull().default(true),
    grantedById: uuid("granted_by_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.permissionCode] }),
    index("user_permissions_permission_idx")
      .on(table.permissionCode, table.userId)
      .where(sql`${table.isGranted}`),
    index("user_permissions_expires_idx")
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} is not null`),
  ],
);

export const badges = pgTable("badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  kind: badgeKindEnum("kind").notNull().default("PERMANENT"),
  criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    awardedById: uuid("awarded_by_id").references(() => users.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    activeFrom: timestamp("active_from", { withTimezone: true }),
    activeUntil: timestamp("active_until", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),
  },
  (table) => [
    index("user_badges_user_active_idx").on(table.userId, table.isActive, table.awardedAt),
  ],
);

export const userExperienceEvents = pgTable(
  "user_experience_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    idempotencyKey: text("idempotency_key").unique(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_experience_events_user_created_idx").on(table.userId, table.createdAt)],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    durationSeconds: integer("duration_seconds"),
    platform: userSessionPlatformEnum("platform").notNull().default("UNKNOWN"),
    appVersion: text("app_version"),
    clientSessionId: text("client_session_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "user_sessions_time_order",
      sql`${table.endedAt} is null or (${table.endedAt}>=${table.startedAt} and ${table.lastActivityAt}>=${table.startedAt})`,
    ),
    check(
      "user_sessions_duration_nonnegative",
      sql`${table.durationSeconds} is null or ${table.durationSeconds}>=0`,
    ),
    index("user_sessions_user_started_idx").on(table.userId, table.startedAt),
    index("user_sessions_active_idx")
      .on(table.lastActivityAt)
      .where(sql`${table.endedAt} is null`),
  ],
);

export const userActivityEvents = pgTable(
  "user_activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => userSessions.id, { onDelete: "set null" }),
    eventType: userActivityEventTypeEnum("event_type").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "user_activity_events_entity_consistency",
      sql`(${table.entityType} is null and ${table.entityId} is null) or ${table.entityType} is not null`,
    ),
    check("user_activity_events_metadata_object", sql`jsonb_typeof(${table.metadata})='object'`),
    index("user_activity_events_user_created_idx").on(table.userId, table.createdAt),
    index("user_activity_events_type_created_idx").on(table.eventType, table.createdAt),
    index("user_activity_events_session_idx")
      .on(table.sessionId, table.createdAt)
      .where(sql`${table.sessionId} is not null`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    technicalName: text("technical_name"),
    displayName: text("display_name"),
    frenchExplanation: text("french_explanation"),
    icon: text("icon"),
    description: text("description"),
    disclaimer: text("disclaimer"),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("categories_visible_sort_idx").on(table.sortOrder, table.name)],
);

export const subcategories = pgTable(
  "subcategories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    technicalName: text("technical_name"),
    displayName: text("display_name"),
    frenchExplanation: text("french_explanation"),
    description: text("description"),
    micronRequirement: micronRequirementEnum("micron_requirement").notNull().default("ABSENT"),
    allowedMicronContexts: micronContextTypeEnum("allowed_micron_contexts")
      .array()
      .notNull()
      .default(sql`'{}'::public.micron_context_type[]`),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("subcategories_category_slug_unique").on(table.categoryId, table.slug),
    unique("subcategories_id_category_unique").on(table.id, table.categoryId),
    index("subcategories_category_sort_idx").on(table.categoryId, table.sortOrder, table.name),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const taxonomyAliases = pgTable(
  "taxonomy_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias")
      .notNull()
      .generatedAlwaysAs(sql`lower(btrim(alias))`),
    targetType: taxonomyTargetTypeEnum("target_type").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
      onDelete: "cascade",
    }),
    tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("taxonomy_aliases_normalized_target_unique").on(table.normalizedAlias, table.targetType),
  ],
);

export const dynamicFieldDefinitions = pgTable(
  "dynamic_field_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    fieldType: dynamicFieldTypeEnum("field_type").notNull(),
    unit: text("unit"),
    placeholder: text("placeholder"),
    validationRules: jsonb("validation_rules")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    isRequired: boolean("is_required").notNull().default(false),
    isFilterable: boolean("is_filterable").notNull().default(false),
    isSearchable: boolean("is_searchable").notNull().default(false),
    isVisible: boolean("is_visible").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("dynamic_field_definitions_scope_sort_idx").on(
      table.categoryId,
      table.subcategoryId,
      table.sortOrder,
    ),
  ],
);

export const dynamicFieldOptions = pgTable(
  "dynamic_field_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fieldDefinitionId: uuid("field_definition_id")
      .notNull()
      .references(() => dynamicFieldDefinitions.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    label: text("label").notNull(),
    technicalName: text("technical_name"),
    displayName: text("display_name"),
    frenchExplanation: text("french_explanation"),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    unique("dynamic_field_options_definition_value_unique").on(
      table.fieldDefinitionId,
      table.value,
    ),
  ],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicNumber: bigint("public_number", { mode: "number" })
      .generatedByDefaultAsIdentity()
      .unique(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    fullDescription: text("full_description"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    subcategoryId: uuid("subcategory_id"),
    declaredVariety: text("declared_variety"),
    declaredProducer: text("declared_producer"),
    method: text("method"),
    texture: text("texture"),
    country: text("country"),
    region: text("region"),
    rarity: entryRarityEnum("rarity").notNull().default("UNKNOWN"),
    status: entryStatusEnum("status").notNull().default("DRAFT"),
    isDemo: boolean("is_demo").notNull().default(false),
    seedKey: text("seed_key").unique(),
    averageRating: numeric("average_rating", { precision: 4, scale: 2 }).notNull().default("0"),
    reviewCount: bigint("review_count", { mode: "number" }).notNull().default(0),
    viewCount: bigint("view_count", { mode: "number" }).notNull().default(0),
    likeCount: bigint("like_count", { mode: "number" }).notNull().default(0),
    favoriteCount: bigint("favorite_count", { mode: "number" }).notNull().default(0),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    originalContributorId: uuid("original_contributor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "set null" }),
    publishedById: uuid("published_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    searchDocument: tsvector("search_document").generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, coalesce(name,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(full_description,'') || ' ' || coalesce(declared_variety,'') || ' ' || coalesce(declared_producer,'') || ' ' || coalesce(method,'') || ' ' || coalesce(texture,'') || ' ' || coalesce(country,'') || ' ' || coalesce(region,''))`,
    ),
  },
  (table) => [
    foreignKey({
      name: "entries_subcategory_category_fk",
      columns: [table.subcategoryId, table.categoryId],
      foreignColumns: [subcategories.id, subcategories.categoryId],
    }).onDelete("restrict"),
    check("entries_demo_seed_consistency", sql`${table.isDemo} = (${table.seedKey} is not null)`),
    index("entries_category_status_published_idx").on(
      table.categoryId,
      table.status,
      table.publishedAt,
    ),
    index("entries_subcategory_idx").on(table.subcategoryId),
    index("entries_created_by_idx").on(table.createdById),
    index("entries_original_contributor_idx").on(table.originalContributorId),
  ],
);

export const entryImages = pgTable(
  "entry_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    storageBucket: text("storage_bucket").notNull(),
    objectPath: text("object_path").notNull(),
    kind: entryImageKindEnum("kind").notNull().default("GALLERY"),
    altText: text("alt_text"),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    sourceUrl: text("source_url"),
    credit: text("credit"),
    licenseName: text("license_name"),
    licenseUrl: text("license_url"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("entry_images_storage_object_unique").on(table.storageBucket, table.objectPath),
    uniqueIndex("entry_images_one_primary_idx")
      .on(table.entryId)
      .where(sql`${table.isPrimary} and ${table.deletedAt} is null`),
    index("entry_images_entry_sort_idx").on(table.entryId, table.sortOrder),
    index("entry_images_created_by_idx").on(table.createdById),
  ],
);

export const entryRevisions = pgTable(
  "entry_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    changeSummary: text("change_summary"),
    changedById: uuid("changed_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("entry_revisions_entry_revision_unique").on(table.entryId, table.revisionNumber),
    index("entry_revisions_changed_by_idx").on(table.changedById),
  ],
);

export const entryViewEvents = pgTable(
  "entry_view_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousSessionHash: text("anonymous_session_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("entry_view_events_entry_created_idx").on(table.entryId, table.createdAt),
    index("entry_view_events_user_entry_created_idx").on(
      table.userId,
      table.entryId,
      table.createdAt,
    ),
  ],
);

export const entryLikes = pgTable(
  "entry_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("entry_likes_entry_user_unique").on(table.entryId, table.userId)],
);

export const contests = pgTable(
  "contests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    description: text("description"),
    rules: text("rules"),
    imageUrl: text("image_url"),
    status: contestStatusEnum("status").notNull().default("DRAFT"),
    contestType: contestTypeEnum("contest_type").notNull().default("OTHER"),
    instructions: text("instructions").notNull().default(""),
    participationSteps: jsonb("participation_steps").$type<unknown[]>().notNull().default([]),
    externalUrl: text("external_url"),
    telegramUrl: text("telegram_url"),
    instagramUrl: text("instagram_url"),
    terms: text("terms"),
    additionalInformation: text("additional_information"),
    registrationsOpen: boolean("registrations_open").notNull().default(true),
    registrationStartsAt: timestamp("registration_starts_at", { withTimezone: true }),
    registrationEndsAt: timestamp("registration_ends_at", { withTimezone: true }),
    registrationsClosedAt: timestamp("registrations_closed_at", { withTimezone: true }),
    shortDescription: text("short_description"),
    publicIntro: text("public_intro"),
    participantInstructions: text("participant_instructions"),
    shortRules: text("short_rules"),
    fullRules: text("full_rules"),
    longDescription: text("long_description"),
    mainImageUrl: text("main_image_url"),
    resultImageUrl: text("result_image_url"),
    mainImageBucket: text("main_image_bucket"),
    mainImagePath: text("main_image_path"),
    resultImageBucket: text("result_image_bucket"),
    resultImagePath: text("result_image_path"),
    resultText: text("result_text"),
    registrationsManuallyClosed: boolean("registrations_manually_closed").notNull().default(false),
    resultPublicationMode: contestResultPublicationModeEnum("result_publication_mode")
      .notNull()
      .default("MANUAL"),
    resultPublishedAt: timestamp("result_published_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    secretWeight: numeric("secret_weight", { precision: 18, scale: 6 }),
    weightUnit: text("weight_unit"),
    customWeightUnit: text("custom_weight_unit"),
    allowGuessEditing: boolean("allow_guess_editing").notNull().default(false),
    tieBreakerMode: contestTieBreakerModeEnum("tie_breaker_mode").notNull().default("MANUAL"),
    notifyTelegramOnPublish: boolean("notify_telegram_on_publish").notNull().default(false),
    notifyParticipantsOnResult: boolean("notify_participants_on_result").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    scoringMode: contestScoringModeEnum("scoring_mode").notNull().default("MANUAL"),
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull().default({}),
    reward: jsonb("reward").$type<Record<string, unknown>>().notNull().default({}),
    rewardBadgeId: uuid("reward_badge_id").references(() => badges.id, {
      onDelete: "set null",
    }),
    maxParticipants: integer("max_participants"),
    requireEntry: boolean("require_entry").notNull().default(true),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("contests_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("contests_title_length", sql`char_length(${table.title}) between 2 and 180`),
    check("contests_summary_length", sql`char_length(${table.summary}) between 2 and 320`),
    check(
      "contests_description_length",
      sql`char_length(${table.description}) between 2 and 20000`,
    ),
    check("contests_rules_length", sql`char_length(${table.rules}) between 2 and 20000`),
    check(
      "contests_image_url_http",
      sql`${table.imageUrl} is null or ${table.imageUrl} ~ '^https?://'`,
    ),
    check("contests_dates_order", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "contests_json_objects",
      sql`jsonb_typeof(${table.criteria})='object' and jsonb_typeof(${table.reward})='object'`,
    ),
    check(
      "contests_participation_steps_array",
      sql`jsonb_typeof(${table.participationSteps})='array'`,
    ),
    check(
      "contests_registration_dates_order",
      sql`${table.registrationStartsAt} is null or ${table.registrationEndsAt} is null or ${table.registrationEndsAt}>${table.registrationStartsAt}`,
    ),
    check(
      "contests_links_http",
      sql`(${table.externalUrl} is null or ${table.externalUrl} ~ '^https?://') and (${table.telegramUrl} is null or ${table.telegramUrl} ~ '^https?://') and (${table.instagramUrl} is null or ${table.instagramUrl} ~ '^https?://')`,
    ),
    check(
      "contests_registration_closed_consistency",
      sql`${table.registrationsOpen} or ${table.registrationsClosedAt} is not null`,
    ),
    check(
      "contests_max_participants_positive",
      sql`${table.maxParticipants} is null or ${table.maxParticipants} > 0`,
    ),
    index("contests_public_schedule_idx")
      .on(table.status, table.startsAt, table.endsAt, table.isFeatured)
      .where(sql`${table.deletedAt} is null`),
    index("contests_reward_badge_idx")
      .on(table.rewardBadgeId)
      .where(sql`${table.rewardBadgeId} is not null`),
  ],
);

export const contestParticipations = pgTable(
  "contest_participations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
    status: contestParticipationStatusEnum("status").notNull().default("PENDING_REVIEW"),
    statement: text("statement"),
    manualScore: numeric("manual_score", { precision: 14, scale: 4 }).notNull().default("0"),
    scoreBreakdown: jsonb("score_breakdown").$type<Record<string, unknown>>().notNull().default({}),
    moderatedById: uuid("moderated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderationNote: text("moderation_note"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (table) => [
    unique("contest_participations_contest_user_unique").on(table.contestId, table.userId),
    unique("contest_participations_id_contest_unique").on(table.id, table.contestId),
    check(
      "contest_participations_statement_length",
      sql`${table.statement} is null or char_length(${table.statement})<=2000`,
    ),
    check(
      "contest_participations_note_length",
      sql`${table.moderationNote} is null or char_length(${table.moderationNote})<=2000`,
    ),
    check(
      "contest_participations_score_object",
      sql`jsonb_typeof(${table.scoreBreakdown})='object'`,
    ),
    check(
      "contest_participations_withdrawal_consistency",
      sql`(${table.status}='WITHDRAWN' and ${table.withdrawnAt} is not null) or (${table.status}<>'WITHDRAWN' and ${table.withdrawnAt} is null)`,
    ),
    index("contest_participations_contest_status_idx").on(
      table.contestId,
      table.status,
      table.submittedAt,
    ),
    index("contest_participations_entry_idx")
      .on(table.entryId)
      .where(sql`${table.entryId} is not null`),
    index("contest_participations_user_idx").on(table.userId, table.submittedAt),
  ],
);

export const contestWinners = pgTable(
  "contest_winners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    participationId: uuid("participation_id").notNull(),
    rank: smallint("rank").notNull(),
    label: text("label"),
    prize: jsonb("prize").$type<Record<string, unknown>>().notNull().default({}),
    selectedById: uuid("selected_by_id").references(() => users.id, { onDelete: "set null" }),
    awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "contest_winners_participation_contest_fk",
      columns: [table.participationId, table.contestId],
      foreignColumns: [contestParticipations.id, contestParticipations.contestId],
    }).onDelete("cascade"),
    unique("contest_winners_contest_rank_unique").on(table.contestId, table.rank),
    unique("contest_winners_contest_participation_unique").on(
      table.contestId,
      table.participationId,
    ),
    check("contest_winners_rank_positive", sql`${table.rank} > 0`),
    check(
      "contest_winners_label_length",
      sql`${table.label} is null or char_length(${table.label})<=180`,
    ),
    check("contest_winners_prize_object", sql`jsonb_typeof(${table.prize})='object'`),
    index("contest_winners_participation_idx").on(table.participationId),
  ],
);

export const contestLinks = pgTable(
  "contest_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    type: contestLinkTypeEnum("type").notNull().default("WEBSITE"),
    visibility: contestLinkVisibilityEnum("visibility").notNull().default("PUBLIC"),
    displayOrder: integer("display_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("contest_links_contest_visibility_order_idx").on(
      table.contestId,
      table.visibility,
      table.displayOrder,
      table.id,
    ),
  ],
);

export const contestGuesses = pgTable(
  "contest_guesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    participationId: uuid("participation_id").notNull(),
    numericValue: numeric("numeric_value", { precision: 18, scale: 6 }).notNull(),
    unit: text("unit").notNull(),
    submissionCount: integer("submission_count").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("contest_guesses_contest_user_key").on(table.contestId, table.userId),
    foreignKey({
      columns: [table.participationId, table.contestId],
      foreignColumns: [contestParticipations.id, contestParticipations.contestId],
    }).onDelete("cascade"),
    check("contest_guesses_numeric_positive", sql`${table.numericValue}>0`),
    check("contest_guesses_submission_count_positive", sql`${table.submissionCount}>0`),
    index("contest_guesses_contest_value_idx").on(
      table.contestId,
      table.numericValue,
      table.submittedAt,
    ),
    index("contest_guesses_user_updated_idx").on(table.userId, table.updatedAt),
  ],
);

export const contestWinnerHistory = pgTable(
  "contest_winner_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    action: contestWinnerHistoryActionEnum("action").notNull(),
    previousWinnerUserId: uuid("previous_winner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    winnerUserId: uuid("winner_user_id").references(() => users.id, { onDelete: "set null" }),
    selectedById: uuid("selected_by_id").references(() => users.id, { onDelete: "set null" }),
    selectedByRole: userRoleEnum("selected_by_role"),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contest_winner_history_contest_created_idx").on(table.contestId, table.createdAt),
  ],
);

export const contestViewEvents = pgTable(
  "contest_view_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: contestEventTypeEnum("event_type").notNull(),
    sessionKeyHash: text("session_key_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("contest_view_events_contest_type_created_idx").on(
      table.contestId,
      table.eventType,
      table.createdAt,
    ),
    index("contest_view_events_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const telegramBroadcasts = pgTable(
  "telegram_broadcasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: telegramBroadcastTypeEnum("type").notNull(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    status: telegramBroadcastStatusEnum("status").notNull().default("QUEUED"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("telegram_broadcasts_status_created_idx").on(table.status, table.createdAt),
    index("telegram_broadcasts_contest_created_idx").on(table.contestId, table.createdAt),
  ],
);

export const telegramBroadcastDeliveries = pgTable(
  "telegram_broadcast_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    broadcastId: uuid("broadcast_id")
      .notNull()
      .references(() => telegramBroadcasts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: telegramDeliveryStatusEnum("status").notNull().default("QUEUED"),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("telegram_broadcast_deliveries_broadcast_user_key").on(table.broadcastId, table.userId),
    index("telegram_broadcast_deliveries_queue_idx").on(
      table.status,
      table.nextAttemptAt,
      table.createdAt,
    ),
  ],
);

export const entryFieldValues = pgTable(
  "entry_field_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    fieldDefinitionId: uuid("field_definition_id")
      .notNull()
      .references(() => dynamicFieldDefinitions.id, { onDelete: "restrict" }),
    optionId: uuid("option_id").references(() => dynamicFieldOptions.id, { onDelete: "restrict" }),
    value: jsonb("value").notNull(),
    displayValue: text("display_value"),
    ...timestamps,
  },
  (table) => [
    unique("entry_field_values_entry_definition_unique").on(table.entryId, table.fieldDefinitionId),
    index("entry_field_values_definition_idx").on(table.fieldDefinitionId),
    index("entry_field_values_option_idx").on(table.optionId),
  ],
);

export const micronSpecifications = pgTable("micron_specifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id")
    .notNull()
    .unique()
    .references(() => entries.id, { onDelete: "cascade" }),
  mode: micronModeEnum("mode").notNull().default("NONE"),
  singleValue: smallint("single_value"),
  minimumValue: smallint("minimum_value"),
  maximumValue: smallint("maximum_value"),
  multipleValues: smallint("multiple_values").array(),
  isFullSpectrum: boolean("is_full_spectrum").notNull().default(false),
  isMixedMicron: boolean("is_mixed_micron").notNull().default(false),
  displayLabel: text("display_label"),
  sourceType: micronSourceEnum("source_type").notNull().default("DECLARED"),
  notes: text("notes"),
  ...timestamps,
});

export const micronPresets = pgTable("micron_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  mode: micronModeEnum("mode").notNull(),
  label: text("label").notNull(),
  context: micronContextTypeEnum("context"),
  technicalName: text("technical_name"),
  displayName: text("display_name"),
  frenchExplanation: text("french_explanation"),
  singleValue: smallint("single_value"),
  minimumValue: smallint("minimum_value"),
  maximumValue: smallint("maximum_value"),
  multipleValues: smallint("multiple_values").array(),
  isFullSpectrum: boolean("is_full_spectrum").notNull().default(false),
  isMixedMicron: boolean("is_mixed_micron").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subcategoryMicronPresets = pgTable(
  "subcategory_micron_presets",
  {
    subcategoryId: uuid("subcategory_id")
      .notNull()
      .references(() => subcategories.id, { onDelete: "cascade" }),
    micronPresetId: uuid("micron_preset_id")
      .notNull()
      .references(() => micronPresets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.subcategoryId, table.micronPresetId] }),
    index("subcategory_micron_presets_preset_idx").on(table.micronPresetId, table.subcategoryId),
  ],
);

export const entryMicronContexts = pgTable(
  "entry_micron_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    context: micronContextTypeEnum("context").notNull(),
    mode: micronModeEnum("mode").notNull().default("NONE"),
    singleValue: smallint("single_value"),
    minimumValue: smallint("minimum_value"),
    maximumValue: smallint("maximum_value"),
    multipleValues: smallint("multiple_values").array(),
    isFullSpectrum: boolean("is_full_spectrum").notNull().default(false),
    isMixedMicron: boolean("is_mixed_micron").notNull().default(false),
    displayLabel: text("display_label"),
    sourceType: micronSourceEnum("source_type").notNull().default("DECLARED"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    unique("entry_micron_contexts_entry_context_unique").on(table.entryId, table.context),
    check(
      "entry_micron_contexts_range_order",
      sql`${table.minimumValue} is null or ${table.maximumValue} is null or ${table.minimumValue}<=${table.maximumValue}`,
    ),
    check(
      "entry_micron_contexts_multiple_values",
      sql`${table.multipleValues} is null or (cardinality(${table.multipleValues}) between 1 and 20 and 0<all(${table.multipleValues}) and 1000>=all(${table.multipleValues}))`,
    ),
    check(
      "entry_micron_contexts_mode_values",
      sql`(${table.mode}='NONE' and ${table.singleValue} is null and ${table.minimumValue} is null and ${table.maximumValue} is null and ${table.multipleValues} is null and not ${table.isFullSpectrum} and not ${table.isMixedMicron}) or (${table.mode}='SINGLE' and ${table.singleValue} is not null) or (${table.mode}='RANGE' and ${table.minimumValue} is not null and ${table.maximumValue} is not null) or (${table.mode}='MULTIPLE' and ${table.multipleValues} is not null) or (${table.mode}='FULL_SPECTRUM' and ${table.isFullSpectrum}) or (${table.mode}='MIXED' and ${table.isMixedMicron})`,
    ),
    index("entry_micron_contexts_context_idx").on(table.context, table.entryId),
  ],
);

export const entryTags = pgTable(
  "entry_tags",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.tagId] }),
    index("entry_tags_tag_idx").on(table.tagId),
  ],
);

export const ratingCriteria = pgTable(
  "rating_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    minimumScore: numeric("minimum_score", { precision: 4, scale: 2 }).notNull().default("0"),
    maximumScore: numeric("maximum_score", { precision: 4, scale: 2 }).notNull().default("10"),
    weight: numeric("weight", { precision: 6, scale: 3 }).notNull().default("1"),
    isRequired: boolean("is_required").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("rating_criteria_category_sort_idx").on(table.categoryId, table.sortOrder)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    authorDisplayNameSnapshot: text("author_display_name_snapshot").notNull(),
    authorUsernameSnapshot: text("author_username_snapshot"),
    content: text("content").notNull(),
    overallRating: numeric("overall_rating", { precision: 4, scale: 2 }).notNull(),
    status: reviewStatusEnum("status").notNull().default("DRAFT"),
    moderatedById: uuid("moderated_by_id").references(() => users.id, { onDelete: "set null" }),
    moderationReason: text("moderation_reason"),
    ...timestamps,
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    changesRequestedAt: timestamp("changes_requested_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("reviews_entry_status_published_idx").on(table.entryId, table.status, table.publishedAt),
    index("reviews_user_idx").on(table.userId),
    index("reviews_moderated_by_idx").on(table.moderatedById),
  ],
);

export const reviewVersions = pgTable(
  "review_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: text("content").notNull(),
    overallRating: numeric("overall_rating", { precision: 4, scale: 2 }).notNull(),
    ratingsSnapshot: jsonb("ratings_snapshot").$type<unknown[]>().notNull().default([]),
    changedById: uuid("changed_by_id").references(() => users.id, { onDelete: "set null" }),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("review_versions_review_version_unique").on(table.reviewId, table.versionNumber),
    index("review_versions_changed_by_idx").on(table.changedById),
    check(
      "review_versions_ratings_snapshot_array",
      sql`jsonb_typeof(${table.ratingsSnapshot})='array'`,
    ),
  ],
);

export const reviewModerationEvents = pgTable(
  "review_moderation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    action: reviewModerationActionEnum("action").notNull(),
    previousStatus: reviewStatusEnum("previous_status"),
    newStatus: reviewStatusEnum("new_status"),
    message: text("message"),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    reviewVersionId: uuid("review_version_id").references(() => reviewVersions.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "review_moderation_events_message_required",
      sql`${table.action} not in ('CHANGES_REQUESTED','REJECTED') or (${table.message} is not null and char_length(btrim(${table.message})) between 1 and 5000)`,
    ),
    check(
      "review_moderation_events_metadata_object",
      sql`jsonb_typeof(${table.metadata})='object'`,
    ),
    check(
      "review_moderation_events_resolution_consistency",
      sql`(${table.resolvedAt} is null and ${table.resolvedByUserId} is null) or ${table.resolvedAt} is not null`,
    ),
    index("review_moderation_events_review_created_idx").on(table.reviewId, table.createdAt),
    index("review_moderation_events_admin_created_idx")
      .on(table.adminId, table.createdAt)
      .where(sql`${table.adminId} is not null`),
    index("review_moderation_events_user_created_idx")
      .on(table.userId, table.createdAt)
      .where(sql`${table.userId} is not null`),
    index("review_moderation_events_action_created_idx").on(table.action, table.createdAt),
    uniqueIndex("review_moderation_events_one_open_change_idx")
      .on(table.reviewId)
      .where(sql`${table.action}='CHANGES_REQUESTED' and ${table.resolvedAt} is null`),
  ],
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: userNotificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    relatedReviewId: uuid("related_review_id").references(() => reviews.id, {
      onDelete: "set null",
    }),
    relatedEntryId: uuid("related_entry_id").references(() => entries.id, {
      onDelete: "set null",
    }),
    relatedContestId: uuid("related_contest_id").references(() => contests.id, {
      onDelete: "set null",
    }),
    actionUrl: text("action_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    telegramSentAt: timestamp("telegram_sent_at", { withTimezone: true }),
    telegramError: text("telegram_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "user_notifications_read_consistency",
      sql`(${table.isRead} and ${table.readAt} is not null) or (not ${table.isRead} and ${table.readAt} is null)`,
    ),
    check("user_notifications_metadata_object", sql`jsonb_typeof(${table.metadata})='object'`),
    index("user_notifications_user_created_idx").on(table.userId, table.createdAt),
    index("user_notifications_user_unread_idx")
      .on(table.userId, table.createdAt)
      .where(sql`not ${table.isRead}`),
    index("user_notifications_review_idx")
      .on(table.relatedReviewId)
      .where(sql`${table.relatedReviewId} is not null`),
  ],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => ratingCriteria.id, { onDelete: "restrict" }),
    score: numeric("score", { precision: 4, scale: 2 }).notNull(),
    ...timestamps,
  },
  (table) => [
    unique("ratings_review_criterion_unique").on(table.reviewId, table.criterionId),
    index("ratings_criterion_idx").on(table.criterionId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("favorites_entry_user_unique").on(table.entryId, table.userId),
    index("favorites_user_idx").on(table.userId),
  ],
);

export const userCollections = pgTable(
  "user_collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    visibility: profileVisibilityEnum("visibility").notNull().default("PRIVATE"),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("user_collections_user_slug_unique").on(table.userId, table.slug),
    index("user_collections_user_idx").on(table.userId),
  ],
);

export const collectionEntries = pgTable(
  "collection_entries",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => userCollections.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.entryId] }),
    index("collection_entries_entry_idx").on(table.entryId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: submissionTypeEnum("type").notNull(),
    status: submissionStatusEnum("status").notNull().default("DRAFT"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    message: text("message"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewReason: text("review_reason"),
    ...timestamps,
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("submissions_status_created_idx").on(table.status, table.createdAt),
    index("submissions_user_idx").on(table.userId),
    index("submissions_entry_idx").on(table.entryId),
    index("submissions_reviewed_by_idx").on(table.reviewedById),
  ],
);

export const submissionChanges = pgTable(
  "submission_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    fieldPath: text("field_path").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("submission_changes_submission_idx").on(table.submissionId)],
);

export const partnerCategories = pgTable("partner_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: partnerCategoryKindEnum("kind").notNull(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => partnerCategories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    logoBucket: text("logo_bucket"),
    logoPath: text("logo_path"),
    coverBucket: text("cover_bucket"),
    coverPath: text("cover_path"),
    websiteUrl: text("website_url"),
    telegramUrl: text("telegram_url"),
    instagramUrl: text("instagram_url"),
    otherUrl: text("other_url"),
    partnershipType: partnershipTypeEnum("partnership_type").notNull().default("COMMUNITY"),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredFrom: timestamp("featured_from", { withTimezone: true }),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    clickCount: bigint("click_count", { mode: "number" }).notNull().default(0),
    ...timestamps,
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("partners_category_active_sort_idx").on(
      table.categoryId,
      table.isActive,
      table.sortOrder,
    ),
  ],
);

export const partnerClickEvents = pgTable(
  "partner_click_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonymousSessionHash: text("anonymous_session_hash"),
    linkType: text("link_type").notNull().default("PROFILE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("partner_click_events_partner_created_idx").on(table.partnerId, table.createdAt),
    index("partner_click_events_user_idx").on(table.userId),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    targetType: reportTargetTypeEnum("target_type").notNull(),
    subject: text("subject").notNull(),
    content: text("content").notNull(),
    status: messageStatusEnum("status").notNull().default("NEW"),
    priority: priorityEnum("priority").notNull().default("NORMAL"),
    relatedEntryId: uuid("related_entry_id").references(() => entries.id, { onDelete: "set null" }),
    relatedReviewId: uuid("related_review_id").references(() => reviews.id, {
      onDelete: "set null",
    }),
    relatedUserId: uuid("related_user_id").references(() => users.id, { onDelete: "set null" }),
    relatedImageId: uuid("related_image_id").references(() => entryImages.id, {
      onDelete: "set null",
    }),
    relatedPartnerId: uuid("related_partner_id").references(() => partners.id, {
      onDelete: "set null",
    }),
    pageUrl: text("page_url"),
    assignedAdminId: uuid("assigned_admin_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    readAt: timestamp("read_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("reports_status_priority_created_idx").on(table.status, table.priority, table.createdAt),
    index("reports_reporter_idx").on(table.reporterUserId),
    index("reports_related_entry_idx").on(table.relatedEntryId),
    index("reports_related_review_idx").on(table.relatedReviewId),
    index("reports_related_user_idx").on(table.relatedUserId),
    index("reports_related_image_idx").on(table.relatedImageId),
    index("reports_related_partner_idx").on(table.relatedPartnerId),
    index("reports_assigned_admin_idx").on(table.assignedAdminId),
  ],
);

export const reportAttachments = pgTable(
  "report_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    storageBucket: text("storage_bucket").notNull().default("message-attachments"),
    objectPath: text("object_path").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("report_attachments_storage_object_unique").on(table.storageBucket, table.objectPath),
  ],
);

export const adminMessages = pgTable(
  "admin_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: messageTypeEnum("type").notNull(),
    problemType: problemTypeEnum("problem_type"),
    subject: text("subject").notNull(),
    content: text("content").notNull(),
    status: messageStatusEnum("status").notNull().default("NEW"),
    priority: priorityEnum("priority").notNull().default("NORMAL"),
    severity: smallint("severity"),
    relatedEntryId: uuid("related_entry_id").references(() => entries.id, { onDelete: "set null" }),
    relatedReviewId: uuid("related_review_id").references(() => reviews.id, {
      onDelete: "set null",
    }),
    relatedPartnerId: uuid("related_partner_id").references(() => partners.id, {
      onDelete: "set null",
    }),
    pageUrl: text("page_url"),
    authorDisplayNameSnapshot: text("author_display_name_snapshot").notNull(),
    authorUsernameSnapshot: text("author_username_snapshot"),
    mayContact: boolean("may_contact").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    assignedAdminId: uuid("assigned_admin_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    readAt: timestamp("read_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("admin_messages_status_priority_created_idx").on(
      table.status,
      table.priority,
      table.createdAt,
    ),
    index("admin_messages_user_idx").on(table.userId),
    index("admin_messages_related_entry_idx").on(table.relatedEntryId),
    index("admin_messages_related_review_idx").on(table.relatedReviewId),
    index("admin_messages_related_partner_idx").on(table.relatedPartnerId),
    index("admin_messages_assigned_admin_idx").on(table.assignedAdminId),
  ],
);

export const adminMessageAttachments = pgTable(
  "admin_message_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminMessageId: uuid("admin_message_id")
      .notNull()
      .references(() => adminMessages.id, { onDelete: "cascade" }),
    storageBucket: text("storage_bucket").notNull().default("message-attachments"),
    objectPath: text("object_path").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("admin_message_attachments_storage_object_unique").on(
      table.storageBucket,
      table.objectPath,
    ),
  ],
);

export const adminOutboundMessages = pgTable(
  "admin_outbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    content: text("content").notNull(),
    status: adminOutboundMessageStatusEnum("status").notNull().default("QUEUED"),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }),
    errorMessage: text("error_message"),
    idempotencyKey: text("idempotency_key").unique(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "admin_outbound_messages_delivery_consistency",
      sql`(${table.status}='SENT' and ${table.sentAt} is not null and ${table.errorMessage} is null) or (${table.status}='FAILED' and ${table.errorMessage} is not null) or ${table.status}='QUEUED'`,
    ),
    index("admin_outbound_messages_user_created_idx").on(table.userId, table.createdAt),
    index("admin_outbound_messages_admin_created_idx").on(table.adminId, table.createdAt),
    index("admin_outbound_messages_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const userModerationEvents = pgTable(
  "user_moderation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: userModerationActionEnum("action").notNull(),
    reason: text("reason").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    previousRole: userRoleEnum("previous_role"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "user_moderation_events_dates_order",
      sql`${table.endsAt} is null or ${table.endsAt}>${table.startsAt}`,
    ),
    check("user_moderation_events_metadata_object", sql`jsonb_typeof(${table.metadata})='object'`),
    index("user_moderation_events_user_created_idx").on(table.userId, table.createdAt),
    index("user_moderation_events_admin_created_idx").on(table.adminId, table.createdAt),
    index("user_moderation_events_action_created_idx").on(table.action, table.createdAt),
  ],
);

export const adminUserNotes = pgTable(
  "admin_user_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    content: text("content").notNull(),
    ...timestamps,
  },
  (table) => [
    index("admin_user_notes_user_created_idx").on(table.userId, table.createdAt),
    index("admin_user_notes_admin_created_idx").on(table.adminId, table.createdAt),
  ],
);

export const roleHistory = pgTable(
  "role_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    previousRole: userRoleEnum("previous_role"),
    newRole: userRoleEnum("new_role").notNull(),
    changedById: uuid("changed_by_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    source: text("source").notNull().default("SYSTEM"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "role_history_actual_change",
      sql`${table.previousRole} is null or ${table.previousRole}<>${table.newRole}`,
    ),
    check("role_history_metadata_object", sql`jsonb_typeof(${table.metadata})='object'`),
    index("role_history_user_created_idx").on(table.userId, table.createdAt),
    index("role_history_new_role_created_idx").on(table.newRole, table.createdAt),
    index("role_history_changed_by_idx")
      .on(table.changedById, table.createdAt)
      .where(sql`${table.changedById} is not null`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: userRoleEnum("actor_role"),
    actorTelegramIdSnapshot: bigint("actor_telegram_id_snapshot", { mode: "number" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    source: text("source").notNull().default("WEB"),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    requestId: text("request_id"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_created_idx").on(table.entityType, table.entityId, table.createdAt),
    index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_actor_role_created_idx")
      .on(table.actorRole, table.createdAt)
      .where(sql`${table.actorRole} is not null`),
    index("audit_logs_action_created_idx").on(table.action, table.createdAt),
    index("audit_logs_source_created_idx").on(table.source, table.createdAt),
  ],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  valueType: settingValueTypeEnum("value_type").notNull().default("JSON"),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const homeSections = pgTable("home_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export const telegramPublications = pgTable(
  "telegram_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: publicationTypeEnum("type").notNull().default("ENTRY"),
    entryId: uuid("entry_id").references(() => entries.id, { onDelete: "set null" }),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null" }),
    status: publicationStatusEnum("status").notNull().default("DRAFT"),
    channelId: text("channel_id"),
    telegramMessageId: bigint("telegram_message_id", { mode: "number" }),
    previewPayload: jsonb("preview_payload").$type<Record<string, unknown>>().notNull().default({}),
    finalPayload: jsonb("final_payload").$type<Record<string, unknown>>(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastError: text("last_error"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    unique("telegram_publications_channel_message_unique").on(
      table.channelId,
      table.telegramMessageId,
    ),
    index("telegram_publications_status_scheduled_idx").on(table.status, table.scheduledAt),
    index("telegram_publications_entry_idx").on(table.entryId),
    index("telegram_publications_partner_idx").on(table.partnerId),
    index("telegram_publications_created_by_idx").on(table.createdById),
  ],
);

export const botConversationStates = pgTable(
  "bot_conversation_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default("default"),
    stateKey: text("state_key").notNull(),
    stateData: jsonb("state_data").$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("bot_conversation_states_user_scope_unique").on(table.userId, table.scope),
    index("bot_conversation_states_expires_idx").on(table.expiresAt),
  ],
);

export const telegramAuthReplays = pgTable("telegram_auth_replays", {
  id: uuid("id").primaryKey().defaultRandom(),
  initDataHash: text("init_data_hash").notNull().unique(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  authDate: timestamp("auth_date", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const telegramUpdateReceipts = pgTable(
  "telegram_update_receipts",
  {
    updateId: bigint("update_id", { mode: "number" }).primaryKey(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    status: text("status").notNull().default("RECEIVED"),
    error: text("error"),
  },
  (table) => [
    index("telegram_update_receipts_status_received_idx").on(table.status, table.receivedAt),
  ],
);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  keyHash: text("key_hash").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  requestCount: integer("request_count").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type AdminMessage = typeof adminMessages.$inferSelect;
export type Contest = typeof contests.$inferSelect;
export type ContestParticipation = typeof contestParticipations.$inferSelect;
export type ContestWinner = typeof contestWinners.$inferSelect;
export type ReviewModerationEvent = typeof reviewModerationEvents.$inferSelect;
export type UserNotification = typeof userNotifications.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type UserActivityEvent = typeof userActivityEvents.$inferSelect;
export type AdminOutboundMessage = typeof adminOutboundMessages.$inferSelect;
export type UserModerationEvent = typeof userModerationEvents.$inferSelect;
export type AdminUserNote = typeof adminUserNotes.$inferSelect;
export type RoleHistory = typeof roleHistory.$inferSelect;
export type EntryMicronContext = typeof entryMicronContexts.$inferSelect;
export type SubcategoryMicronPreset = typeof subcategoryMicronPresets.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type EntryStatus = (typeof entryStatusEnum.enumValues)[number];
export type ContentStatus = EntryStatus;
export type ReviewStatus = (typeof reviewStatusEnum.enumValues)[number];
export type SubmissionStatus = (typeof submissionStatusEnum.enumValues)[number];
