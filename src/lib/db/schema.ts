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
    ...timestamps,
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    index("users_telegram_username_idx").on(table.telegramUsername),
    index("users_role_idx").on(table.role),
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
  notifyReviewStatus: boolean("notify_review_status").notNull().default(true),
  notifySubmissionStatus: boolean("notify_submission_status").notNull().default(true),
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

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
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
    description: text("description"),
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
    approvedAt: timestamp("approved_at", { withTimezone: true }),
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
    changedById: uuid("changed_by_id").references(() => users.id, { onDelete: "set null" }),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("review_versions_review_version_unique").on(table.reviewId, table.versionNumber),
    index("review_versions_changed_by_idx").on(table.changedById),
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

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
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
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type EntryStatus = (typeof entryStatusEnum.enumValues)[number];
export type ContentStatus = EntryStatus;
export type ReviewStatus = (typeof reviewStatusEnum.enumValues)[number];
export type SubmissionStatus = (typeof submissionStatusEnum.enumValues)[number];
