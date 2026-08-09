-- Pokédex / Supabase PostgreSQL schema
-- Run as the project owner from Supabase SQL Editor. Telegram is the application
-- identity provider: writes use the trusted server/direct DB or service_role.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
set local search_path = public, extensions, pg_temp;

do $$ begin create type public.account_kind as enum ('TELEGRAM','SYSTEM');
exception when duplicate_object then null; end $$;
do $$ begin create type public.user_role as enum
  ('OWNER','ADMIN','MODERATOR','EDITOR','MEMBER','BANNED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.profile_visibility as enum
  ('PUBLIC','MEMBERS_ONLY','PRIVATE');
exception when duplicate_object then null; end $$;
do $$ begin create type public.badge_kind as enum
  ('ACTIVE','HISTORICAL','PERMANENT');
exception when duplicate_object then null; end $$;
do $$ begin create type public.entry_status as enum
  ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','PUBLISHED','REJECTED','HIDDEN','ARCHIVED','DELETED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.entry_rarity as enum
  ('UNKNOWN','COMMON','UNCOMMON','RARE','EPIC','LEGENDARY');
exception when duplicate_object then null; end $$;
do $$ begin create type public.entry_image_kind as enum
  ('PRIMARY','GALLERY','PACKAGING','LAB_REPORT');
exception when duplicate_object then null; end $$;
do $$ begin create type public.dynamic_field_type as enum
  ('TEXT','LONG_TEXT','NUMBER','BOOLEAN','SELECT','MULTI_SELECT','DATE','URL');
exception when duplicate_object then null; end $$;
do $$ begin create type public.taxonomy_target_type as enum
  ('CATEGORY','SUBCATEGORY','TAG');
exception when duplicate_object then null; end $$;
do $$ begin create type public.micron_mode as enum
  ('NONE','SINGLE','RANGE','MULTIPLE','FULL_SPECTRUM','MIXED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.micron_source_type as enum
  ('DECLARED','LABEL','PACKAGING','LAB_REPORT','COMMUNITY','UNKNOWN');
exception when duplicate_object then null; end $$;
do $$ begin create type public.review_status as enum
  ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','PUBLISHED','REJECTED','HIDDEN','DELETED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.submission_type as enum ('NEW_ENTRY','CORRECTION');
exception when duplicate_object then null; end $$;
do $$ begin create type public.submission_status as enum
  ('DRAFT','PENDING_REVIEW','CHANGES_REQUESTED','APPROVED','REJECTED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_message_type as enum
  ('IMPROVEMENT','BUG','REPORT','OTHER');
exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_message_status as enum
  ('NEW','READ','IN_PROGRESS','RESOLVED','ARCHIVED','REJECTED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.message_priority as enum ('LOW','NORMAL','HIGH','URGENT');
exception when duplicate_object then null; end $$;
do $$ begin create type public.problem_type as enum
  ('BUG','DISPLAY','INCORRECT_ENTRY','USER','REVIEW','IMAGE','PARTNER','NAVIGATION','OTHER');
exception when duplicate_object then null; end $$;
do $$ begin create type public.report_target_type as enum
  ('ENTRY','REVIEW','USER','IMAGE','PARTNER','OTHER');
exception when duplicate_object then null; end $$;
do $$ begin create type public.telegram_publication_type as enum
  ('ENTRY','PARTNER','ANNOUNCEMENT');
exception when duplicate_object then null; end $$;
do $$ begin create type public.telegram_publication_status as enum
  ('DRAFT','PREVIEWED','SCHEDULED','PUBLISHING','PUBLISHED','FAILED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.setting_value_type as enum
  ('STRING','NUMBER','BOOLEAN','JSON','URL');
exception when duplicate_object then null; end $$;
do $$ begin create type public.partner_category_kind as enum
  ('COMMUNITY','MEDIA','CREATOR','EVENT','ASSOCIATION','BRAND','OTHER');
exception when duplicate_object then null; end $$;

-- Identities, profiles, permissions and badges.
create table if not exists public.users (
  id uuid primary key default extensions.gen_random_uuid(),
  account_kind public.account_kind not null default 'TELEGRAM',
  is_system boolean not null default false,
  telegram_id bigint unique,
  telegram_username text,
  telegram_username_snapshot text,
  display_name text not null check (char_length(display_name) between 1 and 120),
  profile_photo_url text,
  public_slug text not null unique check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  role public.user_role not null default 'MEMBER',
  profile_title text check (profile_title is null or char_length(profile_title) <= 120),
  bio text check (bio is null or char_length(bio) <= 2000),
  experience_points bigint not null default 0 check (experience_points >= 0),
  level integer not null default 1 check (level >= 1),
  featured_entry_id uuid,
  profile_visibility public.profile_visibility not null default 'PUBLIC',
  is_banned boolean not null default false,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  constraint users_identity_consistency check (
    (account_kind='TELEGRAM' and not is_system and telegram_id is not null and telegram_id>0)
    or (account_kind='SYSTEM' and is_system and telegram_id is null)
  ),
  constraint users_ban_role_consistency check ((role = 'BANNED' and is_banned) or role <> 'BANNED'),
  constraint users_suspension_consistency check (suspended_at is null or suspension_reason is not null)
);
create table if not exists public.user_profile_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  locale text not null default 'fr', timezone text not null default 'Europe/Zurich',
  allow_contact boolean not null default true, show_activity boolean not null default true,
  show_badges boolean not null default true, notify_review_status boolean not null default true,
  notify_submission_status boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_.-]+$'),
  name text not null, description text, created_at timestamptz not null default now()
);
create table if not exists public.role_permissions (
  role public.user_role not null,
  permission_code text not null references public.permissions(code) on delete cascade,
  created_at timestamptz not null default now(), primary key (role,permission_code)
);
create table if not exists public.badges (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text, icon text,
  kind public.badge_kind not null default 'PERMANENT',
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria)='object'),
  is_active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_badges (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_by_id uuid references public.users(id) on delete set null,
  is_active boolean not null default true, active_from timestamptz, active_until timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  awarded_at timestamptz not null default now(), revoked_at timestamptz, revoke_reason text,
  check (active_until is null or active_from is null or active_until > active_from)
);
create unique index if not exists user_badges_one_active_idx on public.user_badges(user_id,badge_id)
  where is_active and revoked_at is null;
create table if not exists public.user_experience_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  points integer not null check (points <> 0), reason text not null,
  source_type text, source_id uuid, idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

-- Dynamic taxonomy.
create table if not exists public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, icon text, description text, disclaimer text,
  sort_order integer not null default 0, is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.subcategories (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text, sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, unique(category_id,slug), unique(id,category_id)
);
create table if not exists public.tags (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.taxonomy_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  alias text not null check (char_length(btrim(alias)) between 1 and 120),
  normalized_alias text generated always as (lower(btrim(alias))) stored not null,
  target_type public.taxonomy_target_type not null,
  category_id uuid references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  is_active boolean not null default true, created_at timestamptz not null default now(),
  check (num_nonnulls(category_id,subcategory_id,tag_id)=1
    and (target_type <> 'CATEGORY' or category_id is not null)
    and (target_type <> 'SUBCATEGORY' or subcategory_id is not null)
    and (target_type <> 'TAG' or tag_id is not null)),
  unique(normalized_alias,target_type)
);
create table if not exists public.dynamic_field_definitions (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  subcategory_id uuid references public.subcategories(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'), label text not null,
  description text, field_type public.dynamic_field_type not null, unit text, placeholder text,
  validation_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(validation_rules)='object'),
  is_required boolean not null default false, is_filterable boolean not null default false,
  is_searchable boolean not null default false, is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists dynamic_field_definitions_scope_key_idx
  on public.dynamic_field_definitions(category_id,coalesce(subcategory_id,'00000000-0000-0000-0000-000000000000'::uuid),key);
create table if not exists public.dynamic_field_options (
  id uuid primary key default extensions.gen_random_uuid(),
  field_definition_id uuid not null references public.dynamic_field_definitions(id) on delete cascade,
  value text not null, label text not null, description text,
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(field_definition_id,value)
);

-- Entries and their structured content.
create table if not exists public.entries (
  id uuid primary key default extensions.gen_random_uuid(),
  public_number bigint generated by default as identity unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 180),
  short_description text check (short_description is null or char_length(short_description)<=500),
  full_description text,
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory_id uuid,
  declared_variety text, declared_producer text, method text, texture text, country text, region text,
  rarity public.entry_rarity not null default 'UNKNOWN',
  status public.entry_status not null default 'DRAFT',
  is_demo boolean not null default false,
  seed_key text unique check (seed_key is null or seed_key ~ '^[a-z][a-z0-9_.-]+$'),
  average_rating numeric(4,2) not null default 0 check (average_rating between 0 and 10),
  review_count bigint not null default 0 check (review_count>=0),
  view_count bigint not null default 0 check (view_count>=0),
  like_count bigint not null default 0 check (like_count>=0),
  favorite_count bigint not null default 0 check (favorite_count>=0),
  created_by_id uuid not null references public.users(id) on delete restrict,
  original_contributor_id uuid not null references public.users(id) on delete restrict,
  approved_by_id uuid references public.users(id) on delete set null,
  published_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  approved_at timestamptz, published_at timestamptz, archived_at timestamptz, deleted_at timestamptz,
  search_document tsvector generated always as (to_tsvector('simple'::regconfig,
    coalesce(name,'')||' '||coalesce(short_description,'')||' '||coalesce(full_description,'')||' '||
    coalesce(declared_variety,'')||' '||coalesce(declared_producer,'')||' '||coalesce(method,'')||' '||
    coalesce(texture,'')||' '||coalesce(country,'')||' '||coalesce(region,''))) stored,
  constraint entries_subcategory_category_fk foreign key(subcategory_id,category_id)
    references public.subcategories(id,category_id) on delete restrict,
  constraint entries_demo_seed_consistency check (is_demo = (seed_key is not null)),
  check (published_at is null or approved_at is not null)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='users_featured_entry_id_fkey'
    and conrelid='public.users'::regclass) then
    alter table public.users add constraint users_featured_entry_id_fkey
      foreign key(featured_entry_id) references public.entries(id) on delete set null;
  end if;
end $$;
create table if not exists public.entry_images (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  storage_bucket text not null check (storage_bucket in ('entry-images','entry-drafts')),
  object_path text not null, kind public.entry_image_kind not null default 'GALLERY',
  alt_text text check (alt_text is null or char_length(alt_text)<=300),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  width integer check (width is null or width>0), height integer check (height is null or height>0),
  sort_order integer not null default 0, is_primary boolean not null default false,
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), deleted_at timestamptz,
  check (object_path ~ '^[a-z0-9/_-]+/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$'),
  unique(storage_bucket,object_path)
);
create unique index if not exists entry_images_one_primary_idx on public.entry_images(entry_id)
  where is_primary and deleted_at is null;
create table if not exists public.entry_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  revision_number integer not null check (revision_number>0),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  change_summary text, changed_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), unique(entry_id,revision_number)
);
create table if not exists public.entry_view_events (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  anonymous_session_hash text, created_at timestamptz not null default now(),
  check (num_nonnulls(user_id,anonymous_session_hash)=1),
  check (anonymous_session_hash is null or anonymous_session_hash ~ '^[A-Za-z0-9_-]{32,128}$')
);
create table if not exists public.entry_likes (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(), unique(entry_id,user_id)
);
create table if not exists public.entry_field_values (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  field_definition_id uuid not null references public.dynamic_field_definitions(id) on delete restrict,
  option_id uuid references public.dynamic_field_options(id) on delete restrict,
  value jsonb not null, display_value text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(entry_id,field_definition_id)
);
create table if not exists public.micron_specifications (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null unique references public.entries(id) on delete cascade,
  mode public.micron_mode not null default 'NONE',
  single_value smallint check(single_value between 1 and 1000),
  minimum_value smallint check(minimum_value between 1 and 1000),
  maximum_value smallint check(maximum_value between 1 and 1000), multiple_values smallint[],
  is_full_spectrum boolean not null default false, is_mixed_micron boolean not null default false,
  display_label text, source_type public.micron_source_type not null default 'DECLARED', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(minimum_value is null or maximum_value is null or minimum_value<=maximum_value),
  check(multiple_values is null or (cardinality(multiple_values) between 1 and 20
    and 0 < all(multiple_values) and 1000 >= all(multiple_values))),
  check(
    (mode='NONE' and single_value is null and minimum_value is null and maximum_value is null
      and multiple_values is null and not is_full_spectrum and not is_mixed_micron)
    or (mode='SINGLE' and single_value is not null)
    or (mode='RANGE' and minimum_value is not null and maximum_value is not null)
    or (mode='MULTIPLE' and multiple_values is not null)
    or (mode='FULL_SPECTRUM' and is_full_spectrum)
    or (mode='MIXED' and is_mixed_micron))
);
create table if not exists public.micron_presets (
  id uuid primary key default extensions.gen_random_uuid(), slug text not null unique,
  mode public.micron_mode not null, label text not null,
  single_value smallint, minimum_value smallint, maximum_value smallint, multiple_values smallint[],
  is_full_spectrum boolean not null default false, is_mixed_micron boolean not null default false,
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.entry_tags (
  entry_id uuid not null references public.entries(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(entry_id,tag_id)
);

-- Reviews, criteria, ratings, favorites and collections.
create table if not exists public.rating_criteria (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique check(key ~ '^[a-z][a-z0-9_]*$'), label text not null,
  description text, category_id uuid references public.categories(id) on delete cascade,
  minimum_score numeric(4,2) not null default 0, maximum_score numeric(4,2) not null default 10,
  weight numeric(6,3) not null default 1 check(weight>0), is_required boolean not null default false,
  is_active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(minimum_score>=0 and maximum_score<=10 and minimum_score<maximum_score)
);
create table if not exists public.reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  author_display_name_snapshot text not null, author_username_snapshot text,
  content text not null check(char_length(content) between 10 and 5000),
  overall_rating numeric(4,2) not null check(overall_rating between 0 and 10),
  status public.review_status not null default 'DRAFT',
  moderated_by_id uuid references public.users(id) on delete set null, moderation_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  approved_at timestamptz, published_at timestamptz, hidden_at timestamptz, deleted_at timestamptz,
  check(published_at is null or approved_at is not null)
);
create table if not exists public.review_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  version_number integer not null check(version_number>0), content text not null,
  overall_rating numeric(4,2) not null check(overall_rating between 0 and 10),
  changed_by_id uuid references public.users(id) on delete set null, change_reason text,
  created_at timestamptz not null default now(), unique(review_id,version_number)
);
create table if not exists public.ratings (
  id uuid primary key default extensions.gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  criterion_id uuid not null references public.rating_criteria(id) on delete restrict,
  score numeric(4,2) not null check(score between 0 and 10),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(review_id,criterion_id)
);
create table if not exists public.favorites (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(), unique(entry_id,user_id)
);
create table if not exists public.user_collections (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 120),
  slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description text,
  visibility public.profile_visibility not null default 'PRIVATE',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, unique(user_id,slug)
);
create table if not exists public.collection_entries (
  collection_id uuid not null references public.user_collections(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  sort_order integer not null default 0, added_at timestamptz not null default now(),
  primary key(collection_id,entry_id)
);

-- Community submissions.
create table if not exists public.submissions (
  id uuid primary key default extensions.gen_random_uuid(),
  type public.submission_type not null, status public.submission_status not null default 'DRAFT',
  user_id uuid not null references public.users(id) on delete restrict,
  entry_id uuid references public.entries(id) on delete set null,
  title text not null, message text,
  payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
  reviewed_by_id uuid references public.users(id) on delete set null, review_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  submitted_at timestamptz, reviewed_at timestamptz, deleted_at timestamptz,
  check(type<>'CORRECTION' or entry_id is not null)
);
create table if not exists public.submission_changes (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  field_path text not null, old_value jsonb, new_value jsonb,
  created_at timestamptz not null default now()
);

-- Partners.
create table if not exists public.partner_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  kind public.partner_category_kind not null,
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text, sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.partners (
  id uuid primary key default extensions.gen_random_uuid(),
  category_id uuid not null references public.partner_categories(id) on delete restrict,
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text,
  logo_bucket text check(logo_bucket is null or logo_bucket in ('partner-images','partner-drafts')),
  logo_path text,
  cover_bucket text check(cover_bucket is null or cover_bucket in ('partner-images','partner-drafts')),
  cover_path text,
  website_url text check(website_url is null or website_url ~ '^https://'),
  telegram_url text check(telegram_url is null or telegram_url ~ '^https://'),
  instagram_url text check(instagram_url is null or instagram_url ~ '^https://'),
  other_url text check(other_url is null or other_url ~ '^https://'),
  is_active boolean not null default true, is_featured boolean not null default false,
  featured_from timestamptz, featured_until timestamptz, sort_order integer not null default 0,
  click_count bigint not null default 0 check(click_count>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check(featured_until is null or featured_from is null or featured_until>featured_from),
  check((logo_bucket is null)=(logo_path is null)),
  check((cover_bucket is null)=(cover_path is null))
);
create table if not exists public.partner_click_events (
  id uuid primary key default extensions.gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  anonymous_session_hash text, link_type text not null default 'PROFILE',
  created_at timestamptz not null default now(),
  check(num_nonnulls(user_id,anonymous_session_hash)=1),
  check(anonymous_session_hash is null or anonymous_session_hash ~ '^[A-Za-z0-9_-]{32,128}$')
);

-- Reports and the private user-to-admin inbox.
create table if not exists public.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete restrict,
  target_type public.report_target_type not null,
  subject text not null check(char_length(subject) between 1 and 200),
  content text not null check(char_length(content) between 10 and 5000),
  status public.admin_message_status not null default 'NEW',
  priority public.message_priority not null default 'NORMAL',
  related_entry_id uuid references public.entries(id) on delete set null,
  related_review_id uuid references public.reviews(id) on delete set null,
  related_user_id uuid references public.users(id) on delete set null,
  related_image_id uuid references public.entry_images(id) on delete set null,
  related_partner_id uuid references public.partners(id) on delete set null,
  page_url text, assigned_admin_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  read_at timestamptz, resolved_at timestamptz, archived_at timestamptz
);
create table if not exists public.report_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_bucket text not null default 'message-attachments' check(storage_bucket='message-attachments'),
  object_path text not null,
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint not null check(byte_size between 1 and 8388608),
  created_at timestamptz not null default now(),
  check(object_path ~ '^reports/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$'),
  unique(storage_bucket,object_path)
);
create table if not exists public.admin_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  type public.admin_message_type not null, problem_type public.problem_type,
  subject text not null check(char_length(subject) between 1 and 200),
  content text not null check(char_length(content) between 10 and 5000),
  status public.admin_message_status not null default 'NEW',
  priority public.message_priority not null default 'NORMAL', severity smallint check(severity between 1 and 5),
  related_entry_id uuid references public.entries(id) on delete set null,
  related_review_id uuid references public.reviews(id) on delete set null,
  related_partner_id uuid references public.partners(id) on delete set null,
  page_url text, author_display_name_snapshot text not null, author_username_snapshot text,
  may_contact boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  assigned_admin_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  read_at timestamptz, resolved_at timestamptz, archived_at timestamptz
);
create table if not exists public.admin_message_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  admin_message_id uuid not null references public.admin_messages(id) on delete cascade,
  storage_bucket text not null default 'message-attachments' check(storage_bucket='message-attachments'),
  object_path text not null,
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint not null check(byte_size between 1 and 8388608),
  created_at timestamptz not null default now(),
  check(object_path ~ '^messages/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$'),
  unique(storage_bucket,object_path)
);

-- Audit, settings, Telegram state, replay protection and persistent rate limits.
create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_telegram_id_snapshot bigint,
  action text not null, entity_type text not null, entity_id uuid,
  source text not null default 'WEB' check(source in ('WEB','TELEGRAM','SYSTEM')),
  before_data jsonb, after_data jsonb,
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  request_id text, ip_hash text, user_agent text, created_at timestamptz not null default now(),
  check(ip_hash is null or ip_hash ~ '^[A-Za-z0-9_-]{32,128}$')
);
create table if not exists public.app_settings (
  key text primary key check(key ~ '^[A-Z][A-Z0-9_]*$'), value jsonb not null,
  value_type public.setting_value_type not null default 'JSON', description text,
  is_public boolean not null default false,
  updated_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.home_sections (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique check(key ~ '^[a-z][a-z0-9_-]*$'), title text not null,
  is_enabled boolean not null default true, sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb check(jsonb_typeof(config)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.telegram_publications (
  id uuid primary key default extensions.gen_random_uuid(),
  type public.telegram_publication_type not null default 'ENTRY',
  entry_id uuid references public.entries(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  status public.telegram_publication_status not null default 'DRAFT',
  channel_id text, telegram_message_id bigint,
  preview_payload jsonb not null default '{}'::jsonb check(jsonb_typeof(preview_payload)='object'),
  final_payload jsonb check(final_payload is null or jsonb_typeof(final_payload)='object'),
  scheduled_at timestamptz, published_at timestamptz, last_error text,
  attempt_count integer not null default 0 check(attempt_count>=0),
  created_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(channel_id,telegram_message_id)
);
create table if not exists public.bot_conversation_states (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scope text not null default 'default', state_key text not null,
  state_data jsonb not null default '{}'::jsonb check(jsonb_typeof(state_data)='object'),
  expires_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(user_id,scope)
);
create table if not exists public.telegram_auth_replays (
  id uuid primary key default extensions.gen_random_uuid(),
  init_data_hash text not null unique, telegram_id bigint not null,
  auth_date timestamptz not null, expires_at timestamptz not null,
  created_at timestamptz not null default now(), check(expires_at>auth_date)
);
create table if not exists public.telegram_update_receipts (
  update_id bigint primary key,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'RECEIVED'
    check(status in ('RECEIVED','PROCESSING','PROCESSED','FAILED')),
  error text,
  check((status='PROCESSED' and processed_at is not null and error is null)
    or status<>'PROCESSED'),
  check(error is null or char_length(error)<=4000)
);
create table if not exists public.rate_limit_buckets (
  key_hash text primary key, window_started_at timestamptz not null,
  request_count integer not null default 1 check(request_count>0), expires_at timestamptz not null,
  check(expires_at>window_started_at)
);

-- Query, moderation, search and ranking indexes.
create index if not exists users_telegram_username_idx on public.users(lower(telegram_username))
  where telegram_username is not null;
create index if not exists users_role_idx on public.users(role);
create index if not exists users_featured_entry_idx on public.users(featured_entry_id)
  where featured_entry_id is not null;
create index if not exists users_last_seen_at_idx on public.users(last_seen_at desc);
create index if not exists users_public_profiles_idx on public.users(created_at desc)
  where profile_visibility='PUBLIC' and not is_banned;
create index if not exists user_badges_user_active_idx on public.user_badges(user_id,is_active,awarded_at desc);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission_code);
create index if not exists user_badges_badge_idx on public.user_badges(badge_id);
create index if not exists user_badges_awarded_by_idx on public.user_badges(awarded_by_id)
  where awarded_by_id is not null;
create index if not exists user_experience_events_user_created_idx on public.user_experience_events(user_id,created_at desc);
create index if not exists categories_visible_sort_idx on public.categories(sort_order,name)
  where is_visible and deleted_at is null;
create index if not exists subcategories_category_sort_idx on public.subcategories(category_id,sort_order,name)
  where is_visible and deleted_at is null;
create index if not exists taxonomy_aliases_lookup_idx on public.taxonomy_aliases(normalized_alias) where is_active;
create index if not exists taxonomy_aliases_category_idx on public.taxonomy_aliases(category_id)
  where category_id is not null;
create index if not exists taxonomy_aliases_subcategory_idx on public.taxonomy_aliases(subcategory_id)
  where subcategory_id is not null;
create index if not exists taxonomy_aliases_tag_idx on public.taxonomy_aliases(tag_id)
  where tag_id is not null;
create index if not exists dynamic_field_definitions_scope_sort_idx
  on public.dynamic_field_definitions(category_id,subcategory_id,sort_order)
  where is_visible and deleted_at is null;
create index if not exists dynamic_field_definitions_subcategory_idx
  on public.dynamic_field_definitions(subcategory_id) where subcategory_id is not null;
create index if not exists dynamic_field_options_definition_sort_idx
  on public.dynamic_field_options(field_definition_id,sort_order) where is_active;
create index if not exists entries_status_idx on public.entries(status);
create index if not exists entries_published_at_idx on public.entries(published_at desc)
  where status='PUBLISHED' and deleted_at is null;
create index if not exists entries_view_count_idx on public.entries(view_count desc,published_at desc)
  where status='PUBLISHED' and deleted_at is null;
create index if not exists entries_like_count_idx on public.entries(like_count desc,published_at desc)
  where status='PUBLISHED' and deleted_at is null;
create index if not exists entries_average_rating_idx on public.entries(average_rating desc,review_count desc)
  where status='PUBLISHED' and deleted_at is null;
create index if not exists entries_original_contributor_idx on public.entries(original_contributor_id,published_at desc)
  where status='PUBLISHED' and deleted_at is null;
create index if not exists entries_created_by_idx on public.entries(created_by_id,created_at desc);
create index if not exists entries_category_fk_idx on public.entries(category_id);
create index if not exists entries_subcategory_fk_idx on public.entries(subcategory_id,category_id)
  where subcategory_id is not null;
create index if not exists entries_original_contributor_fk_idx on public.entries(original_contributor_id);
create index if not exists entries_approved_by_idx on public.entries(approved_by_id)
  where approved_by_id is not null;
create index if not exists entries_published_by_idx on public.entries(published_by_id)
  where published_by_id is not null;
create index if not exists entries_category_idx on public.entries(category_id,subcategory_id,published_at desc)
  where status='PUBLISHED' and deleted_at is null;
create index if not exists entries_search_document_idx on public.entries using gin(search_document);
create index if not exists entries_name_trgm_idx on public.entries using gin(name extensions.gin_trgm_ops);
create index if not exists entries_variety_trgm_idx on public.entries using gin(declared_variety extensions.gin_trgm_ops);
create index if not exists entries_producer_trgm_idx on public.entries using gin(declared_producer extensions.gin_trgm_ops);
create index if not exists entry_images_entry_sort_idx on public.entry_images(entry_id,is_primary desc,sort_order)
  where deleted_at is null;
create index if not exists entry_images_entry_fk_idx on public.entry_images(entry_id);
create index if not exists entry_images_created_by_idx on public.entry_images(created_by_id)
  where created_by_id is not null;
create index if not exists entry_revisions_entry_created_idx on public.entry_revisions(entry_id,created_at desc);
create index if not exists entry_revisions_changed_by_idx on public.entry_revisions(changed_by_id)
  where changed_by_id is not null;
create index if not exists entry_view_events_entry_created_idx on public.entry_view_events(entry_id,created_at desc);
create index if not exists entry_view_events_user_idx on public.entry_view_events(user_id,entry_id,created_at desc)
  where user_id is not null;
create index if not exists entry_view_events_session_idx
  on public.entry_view_events(anonymous_session_hash,entry_id,created_at desc)
  where anonymous_session_hash is not null;
create index if not exists entry_view_events_created_idx on public.entry_view_events(created_at desc);
create index if not exists entry_likes_entry_created_idx on public.entry_likes(entry_id,created_at desc);
create index if not exists entry_likes_user_created_idx on public.entry_likes(user_id,created_at desc);
create index if not exists entry_likes_created_idx on public.entry_likes(created_at desc);
create index if not exists entry_field_values_entry_idx on public.entry_field_values(entry_id);
create index if not exists entry_field_values_definition_idx on public.entry_field_values(field_definition_id);
create index if not exists entry_field_values_option_idx on public.entry_field_values(option_id)
  where option_id is not null;
create index if not exists entry_tags_tag_idx on public.entry_tags(tag_id,entry_id);
create index if not exists reviews_status_idx on public.reviews(status);
create index if not exists reviews_entry_published_idx on public.reviews(entry_id,published_at desc)
  where status='PUBLISHED' and deleted_at is null;
create index if not exists reviews_user_status_idx on public.reviews(user_id,status,created_at desc);
create index if not exists reviews_entry_fk_idx on public.reviews(entry_id);
create index if not exists reviews_moderated_by_idx on public.reviews(moderated_by_id)
  where moderated_by_id is not null;
create index if not exists reviews_pending_idx on public.reviews(created_at) where status='PENDING_REVIEW';
create index if not exists ratings_review_idx on public.ratings(review_id);
create index if not exists ratings_criterion_idx on public.ratings(criterion_id);
create index if not exists review_versions_changed_by_idx on public.review_versions(changed_by_id)
  where changed_by_id is not null;
create index if not exists favorites_user_created_idx on public.favorites(user_id,created_at desc);
create index if not exists favorites_entry_idx on public.favorites(entry_id);
create index if not exists collection_entries_entry_idx on public.collection_entries(entry_id);
create index if not exists user_collections_user_idx on public.user_collections(user_id);
create index if not exists submissions_user_status_idx on public.submissions(user_id,status,updated_at desc);
create index if not exists submissions_entry_idx on public.submissions(entry_id)
  where entry_id is not null;
create index if not exists submissions_reviewed_by_idx on public.submissions(reviewed_by_id)
  where reviewed_by_id is not null;
create index if not exists submissions_review_queue_idx on public.submissions(status,submitted_at) where deleted_at is null;
create index if not exists submission_changes_submission_idx on public.submission_changes(submission_id,created_at);
create index if not exists partners_public_sort_idx on public.partners(is_featured desc,sort_order,name)
  where is_active and deleted_at is null;
create index if not exists partners_category_idx on public.partners(category_id,sort_order)
  where is_active and deleted_at is null;
create index if not exists partners_category_fk_idx on public.partners(category_id);
create index if not exists partner_click_events_partner_created_idx on public.partner_click_events(partner_id,created_at desc);
create index if not exists partner_click_events_created_idx on public.partner_click_events(created_at desc);
create index if not exists partner_click_events_user_idx on public.partner_click_events(user_id)
  where user_id is not null;
create index if not exists reports_status_created_idx on public.reports(status,created_at desc);
create index if not exists reports_reporter_idx on public.reports(reporter_user_id,created_at desc);
create index if not exists reports_related_entry_idx on public.reports(related_entry_id)
  where related_entry_id is not null;
create index if not exists reports_related_review_idx on public.reports(related_review_id)
  where related_review_id is not null;
create index if not exists reports_related_user_idx on public.reports(related_user_id)
  where related_user_id is not null;
create index if not exists reports_related_image_idx on public.reports(related_image_id)
  where related_image_id is not null;
create index if not exists reports_related_partner_idx on public.reports(related_partner_id)
  where related_partner_id is not null;
create index if not exists report_attachments_report_idx on public.report_attachments(report_id);
create index if not exists reports_assigned_admin_idx on public.reports(assigned_admin_id,status)
  where assigned_admin_id is not null;
create index if not exists admin_messages_status_idx on public.admin_messages(status);
create index if not exists admin_messages_created_at_idx on public.admin_messages(created_at desc);
create index if not exists admin_messages_assigned_admin_idx
  on public.admin_messages(assigned_admin_id,status,created_at desc) where assigned_admin_id is not null;
create index if not exists admin_messages_new_idx on public.admin_messages(created_at) where status='NEW';
create index if not exists admin_messages_user_idx on public.admin_messages(user_id,created_at desc);
create index if not exists admin_messages_related_entry_idx on public.admin_messages(related_entry_id)
  where related_entry_id is not null;
create index if not exists admin_messages_related_review_idx on public.admin_messages(related_review_id)
  where related_review_id is not null;
create index if not exists admin_messages_related_partner_idx on public.admin_messages(related_partner_id)
  where related_partner_id is not null;
create index if not exists admin_message_attachments_message_idx
  on public.admin_message_attachments(admin_message_id);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type,entity_id,created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id,created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists telegram_publications_status_idx on public.telegram_publications(status,scheduled_at);
create index if not exists telegram_publications_entry_idx on public.telegram_publications(entry_id)
  where entry_id is not null;
create index if not exists telegram_publications_partner_idx on public.telegram_publications(partner_id)
  where partner_id is not null;
create index if not exists telegram_publications_created_by_idx on public.telegram_publications(created_by_id)
  where created_by_id is not null;
create index if not exists bot_conversation_states_expires_idx on public.bot_conversation_states(expires_at)
  where expires_at is not null;
create index if not exists telegram_auth_replays_expires_at_idx on public.telegram_auth_replays(expires_at);
create index if not exists telegram_update_receipts_status_received_idx
  on public.telegram_update_receipts(status,received_at);
create index if not exists rate_limit_buckets_expires_at_idx on public.rate_limit_buckets(expires_at);

-- Integrity and aggregate-counter triggers.
create or replace function public.set_updated_at() returns trigger language plpgsql
set search_path='' as $$ begin new.updated_at:=now(); return new; end $$;
do $$ declare table_name text; begin
  foreach table_name in array array[
    'users','user_profile_settings','badges','categories','subcategories','tags',
    'dynamic_field_definitions','dynamic_field_options','entries','entry_field_values',
    'micron_specifications','rating_criteria','reviews','ratings','user_collections',
    'submissions','partner_categories','partners','reports','admin_messages','app_settings',
    'home_sections','telegram_publications','bot_conversation_states'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I',table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',table_name);
  end loop;
end $$;
create or replace function public.ensure_user_profile_settings() returns trigger language plpgsql
security definer set search_path='' as $$ begin
  insert into public.user_profile_settings(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end $$;
drop trigger if exists ensure_user_profile_settings on public.users;
create trigger ensure_user_profile_settings after insert on public.users
  for each row execute function public.ensure_user_profile_settings();
create or replace function public.prevent_original_contributor_change() returns trigger language plpgsql
set search_path='' as $$ begin
  if new.original_contributor_id is distinct from old.original_contributor_id then
    raise exception 'original_contributor_id is immutable' using errcode='23514';
  end if; return new;
end $$;
drop trigger if exists prevent_original_contributor_change on public.entries;
create trigger prevent_original_contributor_change before update of original_contributor_id on public.entries
  for each row execute function public.prevent_original_contributor_change();
create or replace function public.bump_entry_view_count() returns trigger language plpgsql
security definer set search_path='' as $$ begin
  update public.entries set view_count=view_count+1 where id=new.entry_id; return new;
end $$;
drop trigger if exists bump_entry_view_count on public.entry_view_events;
create trigger bump_entry_view_count after insert on public.entry_view_events
  for each row execute function public.bump_entry_view_count();
create or replace function public.sync_entry_like_count() returns trigger language plpgsql
security definer set search_path='' as $$ begin
  if tg_op='INSERT' then
    update public.entries set like_count=like_count+1 where id=new.entry_id; return new;
  end if;
  update public.entries set like_count=greatest(like_count-1,0) where id=old.entry_id; return old;
end $$;
drop trigger if exists sync_entry_like_count_insert on public.entry_likes;
create trigger sync_entry_like_count_insert after insert on public.entry_likes
  for each row execute function public.sync_entry_like_count();
drop trigger if exists sync_entry_like_count_delete on public.entry_likes;
create trigger sync_entry_like_count_delete after delete on public.entry_likes
  for each row execute function public.sync_entry_like_count();
create or replace function public.sync_entry_favorite_count() returns trigger language plpgsql
security definer set search_path='' as $$ begin
  if tg_op='INSERT' then
    update public.entries set favorite_count=favorite_count+1 where id=new.entry_id; return new;
  end if;
  update public.entries set favorite_count=greatest(favorite_count-1,0) where id=old.entry_id; return old;
end $$;
drop trigger if exists sync_entry_favorite_count_insert on public.favorites;
create trigger sync_entry_favorite_count_insert after insert on public.favorites
  for each row execute function public.sync_entry_favorite_count();
drop trigger if exists sync_entry_favorite_count_delete on public.favorites;
create trigger sync_entry_favorite_count_delete after delete on public.favorites
  for each row execute function public.sync_entry_favorite_count();
create or replace function public.refresh_entry_review_stats(p_entry_id uuid) returns void language sql
security definer set search_path='' as $$
  update public.entries e set review_count=s.review_count,average_rating=s.average_rating
  from (select count(*)::bigint review_count,
    coalesce(round(avg(r.overall_rating),2),0)::numeric(4,2) average_rating
    from public.reviews r where r.entry_id=p_entry_id and r.status='PUBLISHED' and r.deleted_at is null) s
  where e.id=p_entry_id;
$$;
create or replace function public.sync_review_stats() returns trigger language plpgsql
security definer set search_path='' as $$ begin
  if tg_op='DELETE' then perform public.refresh_entry_review_stats(old.entry_id); return old; end if;
  perform public.refresh_entry_review_stats(new.entry_id);
  if tg_op='UPDATE' and old.entry_id is distinct from new.entry_id then
    perform public.refresh_entry_review_stats(old.entry_id);
  end if; return new;
end $$;
drop trigger if exists sync_review_stats on public.reviews;
create trigger sync_review_stats after insert or update of entry_id,status,overall_rating,deleted_at or delete
  on public.reviews for each row execute function public.sync_review_stats();
create or replace function public.sync_partner_click_count() returns trigger language plpgsql
security definer set search_path='' as $$ begin
  update public.partners set click_count=click_count+1 where id=new.partner_id; return new;
end $$;
drop trigger if exists sync_partner_click_count on public.partner_click_events;
create trigger sync_partner_click_count after insert on public.partner_click_events
  for each row execute function public.sync_partner_click_count();
create or replace function public.apply_experience_event() returns trigger language plpgsql
security definer set search_path='' as $$ begin
  if exists(select 1 from public.users u where u.id=new.user_id and u.is_system) then
    return new;
  end if;
  if new.source_type='ENTRY' and new.source_id is not null
    and exists(select 1 from public.entries e where e.id=new.source_id and e.is_demo) then
    return new;
  end if;
  update public.users set
    experience_points=greatest(experience_points+new.points,0),
    level=greatest(1,floor(sqrt(greatest(experience_points+new.points,0)::numeric/100))::integer+1)
  where id=new.user_id; return new;
end $$;
drop trigger if exists apply_experience_event on public.user_experience_events;
create trigger apply_experience_event after insert on public.user_experience_events
  for each row execute function public.apply_experience_event();

-- Timezone-aware bounds and atomic public-stat mutations.
create or replace function public.get_app_timezone() returns text language plpgsql stable
security definer set search_path='' as $$ declare timezone_name text; begin
  select value#>>'{}' into timezone_name from public.app_settings where key='APP_TIMEZONE';
  if timezone_name is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=timezone_name) then
    return 'Europe/Zurich';
  end if; return timezone_name;
end $$;
create or replace function public.ranking_period_start(p_period text,p_timezone text default null)
returns timestamptz language plpgsql stable security definer
set search_path='' as $$
declare normalized_period text:=upper(btrim(coalesce(p_period,'ALL')));
  timezone_name text:=coalesce(nullif(p_timezone,''),public.get_app_timezone());
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=timezone_name) then
    raise exception 'Unknown timezone: %',timezone_name using errcode='22023';
  end if;
  case normalized_period
    when 'WEEK' then return date_trunc('week',now() at time zone timezone_name) at time zone timezone_name;
    when 'MONTH' then return date_trunc('month',now() at time zone timezone_name) at time zone timezone_name;
    when 'ALL' then return null; when 'GENERAL' then return null; when 'ALL_TIME' then return null;
    else raise exception 'Unsupported ranking period: %',p_period using errcode='22023';
  end case;
end $$;
create or replace function public.record_entry_view(
  p_entry_id uuid,p_user_id uuid,p_anonymous_session_hash text,p_dedup_hours integer default null)
returns table(counted boolean,view_count bigint) language plpgsql security definer
set search_path='' as $$
declare effective_user_id uuid:=p_user_id;
  effective_session_hash text:=case when p_user_id is null then p_anonymous_session_hash else null end;
  effective_dedup_hours integer; current_view_count bigint; entry_is_public boolean; identity_key text;
begin
  if p_entry_id is null then raise exception 'entry id is required' using errcode='22004'; end if;
  if effective_user_id is null and effective_session_hash is null then
    raise exception 'a user id or anonymous session hash is required' using errcode='22004';
  end if;
  if effective_session_hash is not null and effective_session_hash !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'anonymous session hash has an invalid format' using errcode='22023';
  end if;
  if effective_user_id is not null and not exists(select 1 from public.users where id=effective_user_id) then
    raise exception 'unknown user' using errcode='23503';
  end if;
  select e.status='PUBLISHED' and e.deleted_at is null,e.view_count
    into entry_is_public,current_view_count from public.entries e where e.id=p_entry_id;
  if not found then raise exception 'unknown entry' using errcode='P0002'; end if;
  if not entry_is_public then return query select false,current_view_count; return; end if;
  if p_dedup_hours is null then
    select case when value#>>'{}' ~ '^[0-9]+$' then (value#>>'{}')::integer end
      into effective_dedup_hours from public.app_settings where key='ENTRY_VIEW_DEDUP_HOURS';
  else effective_dedup_hours:=p_dedup_hours; end if;
  effective_dedup_hours:=coalesce(effective_dedup_hours,6);
  if effective_dedup_hours not between 1 and 168 then
    raise exception 'dedup hours must be between 1 and 168' using errcode='22023';
  end if;
  identity_key:=p_entry_id::text||':'||coalesce(effective_user_id::text,effective_session_hash);
  perform pg_advisory_xact_lock(hashtextextended(identity_key,0));
  if exists(select 1 from public.entry_view_events ve where ve.entry_id=p_entry_id
    and ve.created_at>=now()-make_interval(hours=>effective_dedup_hours)
    and ((effective_user_id is not null and ve.user_id=effective_user_id)
      or (effective_user_id is null and ve.anonymous_session_hash=effective_session_hash))) then
    select e.view_count into current_view_count from public.entries e where e.id=p_entry_id;
    return query select false,current_view_count; return;
  end if;
  insert into public.entry_view_events(entry_id,user_id,anonymous_session_hash)
    values(p_entry_id,effective_user_id,effective_session_hash);
  select e.view_count into current_view_count from public.entries e where e.id=p_entry_id;
  return query select true,current_view_count;
end $$;
create or replace function public.toggle_entry_like(p_entry_id uuid,p_user_id uuid,p_like boolean)
returns table(liked boolean,like_count bigint) language plpgsql security definer
set search_path='' as $$
declare current_like_count bigint; target_is_public boolean; user_can_interact boolean;
begin
  if p_entry_id is null or p_user_id is null or p_like is null then
    raise exception 'entry id, user id and target like state are required' using errcode='22004';
  end if;
  select not u.is_banned and u.role<>'BANNED' and u.suspended_at is null into user_can_interact
    from public.users u where u.id=p_user_id;
  if not found then raise exception 'unknown user' using errcode='23503'; end if;
  if not user_can_interact then raise exception 'user may not interact' using errcode='42501'; end if;
  select e.status='PUBLISHED' and e.deleted_at is null into target_is_public
    from public.entries e where e.id=p_entry_id;
  if not found then raise exception 'unknown entry' using errcode='P0002'; end if;
  if not target_is_public then raise exception 'entry is not public' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_entry_id::text||':'||p_user_id::text,1));
  if p_like then
    insert into public.entry_likes(entry_id,user_id) values(p_entry_id,p_user_id)
      on conflict(entry_id,user_id) do nothing;
  else delete from public.entry_likes where entry_id=p_entry_id and user_id=p_user_id; end if;
  select e.like_count into current_like_count from public.entries e where e.id=p_entry_id;
  return query select p_like,current_like_count;
end $$;

-- Dynamic rankings (Monday-based week and calendar month in APP_TIMEZONE).
create or replace function public.get_trainer_rankings(
  p_period text default 'ALL',p_limit integer default 50,p_offset integer default 0)
returns table(
  rank bigint,user_id uuid,public_slug text,display_name text,telegram_username text,
  profile_photo_url text,profile_title text,level integer,
  period_capture_count bigint,total_capture_count bigint,
  primary_badge_slug text,primary_badge_name text,primary_badge_icon text)
language sql stable security definer set search_path='' as $$
  with period_bound as (select public.ranking_period_start(p_period,null) starts_at),
  counts as (
    select u.id user_id,u.public_slug,u.display_name,u.telegram_username,u.profile_photo_url,
      u.profile_title,u.level,
      count(e.id) filter(where pb.starts_at is null or e.published_at>=pb.starts_at)::bigint period_capture_count,
      count(e.id)::bigint total_capture_count
    from public.users u cross join period_bound pb
    left join public.entries e on e.original_contributor_id=u.id and e.status='PUBLISHED'
      and e.deleted_at is null and e.published_at is not null and not e.is_demo
    where u.account_kind='TELEGRAM' and not u.is_system
      and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED'
    group by u.id,u.public_slug,u.display_name,u.telegram_username,u.profile_photo_url,u.profile_title,u.level
  ), ranked as (
    select rank() over(order by c.period_capture_count desc,c.total_capture_count desc) calculated_rank,c.*
    from counts c where c.period_capture_count>0)
  select r.calculated_rank,r.user_id,r.public_slug,r.display_name,r.telegram_username,
    r.profile_photo_url,r.profile_title,r.level,r.period_capture_count,r.total_capture_count,
    badge.slug,badge.name,badge.icon
  from ranked r left join lateral (
    select b.slug,b.name,b.icon from public.user_badges ub join public.badges b on b.id=ub.badge_id
    where ub.user_id=r.user_id and ub.is_active and ub.revoked_at is null and b.is_active
      and (ub.active_from is null or ub.active_from<=now())
      and (ub.active_until is null or ub.active_until>now())
    order by case b.kind when 'ACTIVE' then 0 when 'PERMANENT' then 1 else 2 end,
      b.sort_order,ub.awarded_at desc limit 1) badge on true
  order by r.calculated_rank,r.total_capture_count desc,r.display_name,r.user_id
  limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
$$;
create or replace function public.get_entry_rankings(
  p_metric text default 'VIEWS',p_period text default 'ALL',
  p_limit integer default 50,p_offset integer default 0)
returns table(
  rank bigint,entry_id uuid,public_number bigint,slug text,name text,
  category_slug text,category_name text,metric_value numeric,
  view_count bigint,like_count bigint,review_count bigint,average_rating numeric,published_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare normalized_metric text:=upper(btrim(coalesce(p_metric,'VIEWS')));
  starts_at timestamptz:=public.ranking_period_start(p_period,null);
begin
  if normalized_metric not in ('VIEWS','LIKES','RATING','RECENT') then
    raise exception 'Unsupported ranking metric: %',p_metric using errcode='22023';
  end if;
  return query
  with metrics as (
    select e.id,e.public_number,e.slug,e.name,c.slug category_slug,c.name category_name,
      e.view_count,e.like_count,e.review_count,e.average_rating,e.published_at,
      case normalized_metric
        when 'VIEWS' then case when starts_at is null then e.view_count::numeric else
          (select count(*)::numeric from public.entry_view_events ve
            where ve.entry_id=e.id and ve.created_at>=starts_at) end
        when 'LIKES' then case when starts_at is null then e.like_count::numeric else
          (select count(*)::numeric from public.entry_likes el
            where el.entry_id=e.id and el.created_at>=starts_at) end
        when 'RATING' then case when starts_at is null then e.average_rating::numeric else
          coalesce((select round(avg(rv.overall_rating),2)::numeric from public.reviews rv
            where rv.entry_id=e.id and rv.status='PUBLISHED' and rv.deleted_at is null
              and rv.published_at>=starts_at),0) end
        when 'RECENT' then extract(epoch from e.published_at)::numeric end metric_value
    from public.entries e join public.categories c on c.id=e.category_id
    where e.status='PUBLISHED' and e.deleted_at is null and e.published_at is not null
      and (normalized_metric<>'RECENT' or starts_at is null or e.published_at>=starts_at)
  ), ranked as (
    select rank() over(order by m.metric_value desc) calculated_rank,m.*
    from metrics m where normalized_metric='RECENT' or m.metric_value>0)
  select r.calculated_rank,r.id,r.public_number,r.slug,r.name,r.category_slug,r.category_name,
    r.metric_value,r.view_count,r.like_count,r.review_count,r.average_rating,r.published_at
  from ranked r order by r.calculated_rank,r.published_at desc,r.id
  limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
end $$;

-- Atomic admin assignment, append-only audit API and cleanup hook for a scheduler.
create or replace function public.assign_admin_message(p_message_id uuid,p_admin_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare assigned boolean; begin
  if not exists(select 1 from public.users where id=p_admin_user_id
    and role in ('OWNER','ADMIN','MODERATOR') and not is_banned) then
    raise exception 'assignee is not an authorized administrator' using errcode='42501';
  end if;
  update public.admin_messages set assigned_admin_id=p_admin_user_id,
    status=case when status in ('NEW','READ') then 'IN_PROGRESS' else status end,
    read_at=coalesce(read_at,now())
  where id=p_message_id and status not in ('RESOLVED','ARCHIVED','REJECTED')
    and (assigned_admin_id is null or assigned_admin_id=p_admin_user_id)
  returning true into assigned;
  return coalesce(assigned,false);
end $$;
create or replace function public.append_audit_log(
  p_actor_user_id uuid,p_action text,p_entity_type text,p_entity_id uuid default null,
  p_before_data jsonb default null,p_after_data jsonb default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare audit_id uuid; begin
  if nullif(btrim(p_action),'') is null or nullif(btrim(p_entity_type),'') is null then
    raise exception 'action and entity type are required' using errcode='22004';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata)<>'object' then
    raise exception 'metadata must be a JSON object' using errcode='22023';
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,metadata)
    values(p_actor_user_id,p_action,p_entity_type,p_entity_id,p_before_data,p_after_data,p_metadata)
    returning id into audit_id;
  return audit_id;
end $$;
create or replace function public.purge_expired_security_state()
returns table(deleted_auth_replays bigint,deleted_rate_limits bigint,deleted_bot_states bigint,
  deleted_update_receipts bigint)
language plpgsql security definer set search_path='' as $$
declare auth_count bigint; rate_count bigint; state_count bigint; receipt_count bigint; begin
  delete from public.telegram_auth_replays where expires_at<=now(); get diagnostics auth_count=row_count;
  delete from public.rate_limit_buckets where expires_at<=now(); get diagnostics rate_count=row_count;
  delete from public.bot_conversation_states where expires_at<=now(); get diagnostics state_count=row_count;
  delete from public.telegram_update_receipts
    where received_at<now()-interval '30 days' and status in ('PROCESSED','FAILED');
  get diagnostics receipt_count=row_count;
  return query select auth_count,rate_count,state_count,receipt_count;
end $$;

-- Idempotent initial configuration and editorial taxonomy.
insert into public.permissions(code,name,description) values
  ('entry.create','Créer des captures','Créer une fiche ou un brouillon'),
  ('entry.update.own','Modifier ses captures','Modifier ses propres brouillons'),
  ('entry.update.any','Modifier toutes les captures','Modifier toute fiche autorisée'),
  ('entry.moderate','Modérer les captures','Valider, refuser et publier les fiches'),
  ('review.create','Créer des avis','Proposer un avis'),
  ('review.moderate','Modérer les avis','Valider, masquer et refuser les avis'),
  ('message.create','Contacter l’équipe','Créer un message administratif'),
  ('message.manage','Gérer les messages','Lire, assigner et résoudre les messages'),
  ('partner.manage','Gérer les partenaires','Administrer les partenaires'),
  ('category.manage','Gérer la taxonomie','Administrer catégories et champs'),
  ('storage.upload.entry','Téléverser des images de fiche','Déposer des médias de capture'),
  ('storage.upload.partner','Téléverser des images partenaire','Déposer des médias administratifs'),
  ('storage.upload.message','Téléverser des pièces jointes','Déposer une pièce jointe privée'),
  ('telegram.admin','Administrer via Telegram','Utiliser les commandes Telegram admin'),
  ('publication.manage','Gérer les publications','Prévisualiser et publier sur Telegram'),
  ('user.manage','Gérer les utilisateurs','Administrer rôles et suspensions'),
  ('badge.manage','Gérer les badges','Créer, modifier, attribuer et révoquer des badges'),
  ('settings.manage','Gérer les paramètres','Administrer la configuration'),
  ('audit.read','Lire le journal','Consulter le journal administratif')
on conflict(code) do update set name=excluded.name,description=excluded.description;

insert into public.role_permissions(role,permission_code)
select 'OWNER'::public.user_role,p.code from public.permissions p
on conflict do nothing;
insert into public.role_permissions(role,permission_code)
select 'ADMIN'::public.user_role,p.code from public.permissions p
on conflict do nothing;
insert into public.role_permissions(role,permission_code) values
  ('MODERATOR','review.create'),('MODERATOR','review.moderate'),
  ('MODERATOR','message.create'),('MODERATOR','message.manage'),
  ('MODERATOR','storage.upload.message'),('MODERATOR','telegram.admin'),
  ('EDITOR','entry.create'),('EDITOR','entry.update.own'),('EDITOR','review.create'),
  ('EDITOR','message.create'),('EDITOR','storage.upload.entry'),('EDITOR','storage.upload.message'),
  ('MEMBER','entry.create'),('MEMBER','entry.update.own'),('MEMBER','review.create'),
  ('MEMBER','message.create'),('MEMBER','storage.upload.entry'),('MEMBER','storage.upload.message')
on conflict do nothing;

insert into public.categories(slug,name,icon,description,disclaimer,sort_order,is_visible) values
  ('fleur','Fleur','🌿','Fiches descriptives consacrées aux fleurs et présentations associées',null,10,true),
  ('pre-roll','Pré-roll','🌿','Pré-rolls décrits à titre éditorial et communautaire',null,20,true),
  ('hash','Hash','🟤','Présentations de hash et informations déclarées','Les qualités et microns sont déclaratifs et ne constituent pas une garantie.',30,true),
  ('rosin','Rosin','💧','Présentations éditoriales de rosin',null,40,true),
  ('extractions-solvants','Extractions avec solvants','💎','Catalogue informatif des formats déclarés','Aucun tutoriel ou procédé de fabrication n’est fourni.',50,true),
  ('vape','Vape','🔋','Formats de vape décrits à titre informatif',null,60,true),
  ('edibles','Edibles','🍬','Produits comestibles présentés sans offre commerciale',null,70,true),
  ('medicinal','Médicinal','💊','Présentations descriptives de formats déclarés','Les informations publiées ne remplacent pas un avis médical.',80,true),
  ('topiques','Topiques','🧴','Formats topiques présentés à titre descriptif',null,90,true),
  ('concentres-sans-solvant','Concentrés sans solvant','🌱','Catalogue informatif de concentrés déclarés',null,100,true)
on conflict(slug) do update set name=excluded.name,icon=excluded.icon,
  description=excluded.description,disclaimer=excluded.disclaimer,sort_order=excluded.sort_order;

insert into public.subcategories(category_id,slug,name,sort_order)
select c.id,v.slug,v.name,v.sort_order
from (values
  ('fleur','indoor','Indoor',10),('fleur','greenhouse','Greenhouse',20),
  ('fleur','outdoor','Outdoor',30),('fleur','light-assisted','Light Assisted',40),
  ('fleur','fresh-frozen','Fresh Frozen',50),('fleur','trim','Trim',60),
  ('fleur','smalls','Smalls',70),('fleur','popcorn','Popcorn',80),('fleur','shake','Shake',90),
  ('pre-roll','joint','Joint',10),('pre-roll','cone','Cone',20),('pre-roll','blunt','Blunt',30),
  ('pre-roll','infused','Infused',40),('pre-roll','hash-hole','Hash Hole',50),('pre-roll','donut','Donut',60),
  ('hash','dry-sift','Dry Sift',10),('hash','static-sift','Static Sift',20),
  ('hash','bubble-hash','Bubble Hash',30),('hash','ice-water-hash','Ice Water Hash',40),
  ('hash','full-melt','Full Melt',50),('hash','half-melt','Half Melt',60),
  ('hash','temple-ball','Temple Ball',70),('hash','charas','Charas',80),
  ('hash','afghan-hash','Afghan Hash',90),('hash','moroccan-hash','Moroccan Hash',100),
  ('hash','lebanese-hash','Lebanese Hash',110),('hash','piatella','Piatella',120),('hash','autre','Autre',130),
  ('rosin','flower-rosin','Flower Rosin',10),('rosin','hash-rosin','Hash Rosin',20),
  ('rosin','live-rosin','Live Rosin',30),('rosin','autre','Autre',40),
  ('extractions-solvants','live-resin','Live Resin',10),('extractions-solvants','cured-resin','Cured Resin',20),
  ('extractions-solvants','bho','BHO',30),('extractions-solvants','pho','PHO',40),
  ('extractions-solvants','co2','CO₂',50),('extractions-solvants','distillate','Distillate',60),
  ('extractions-solvants','hte','HTE',70),('extractions-solvants','htfse','HTFSE',80),
  ('extractions-solvants','sauce','Sauce',90),('extractions-solvants','crystalline','Crystalline',100),
  ('extractions-solvants','diamonds','Diamonds',110),('extractions-solvants','diamonds-sauce','Diamonds & Sauce',120),
  ('extractions-solvants','wax','Wax',130),('extractions-solvants','crumble','Crumble',140),
  ('extractions-solvants','budder','Budder',150),('extractions-solvants','batter','Batter',160),
  ('extractions-solvants','badder','Badder',170),('extractions-solvants','shatter','Shatter',180),
  ('extractions-solvants','pull-snap','Pull & Snap',190),('extractions-solvants','sap','Sap',200),
  ('extractions-solvants','sugar','Sugar',210),('extractions-solvants','isolate','Isolate',220),
  ('extractions-solvants','rso','RSO',230),('extractions-solvants','feco','FECO',240),
  ('extractions-solvants','autre','Autre',250),
  ('vape','cartridge-510','Cartridge 510',10),('vape','disposable','Disposable',20),
  ('vape','pod','Pod',30),('vape','live-resin','Live Resin',40),('vape','live-rosin','Live Rosin',50),
  ('vape','distillate','Distillate',60),('vape','full-spectrum','Full Spectrum',70),
  ('vape','broad-spectrum','Broad Spectrum',80),('vape','autre','Autre',90),
  ('edibles','gummies','Gummies',10),('edibles','chocolat','Chocolat',20),
  ('edibles','bonbons','Bonbons',30),('edibles','cookies','Cookies',40),
  ('edibles','brownies','Brownies',50),('edibles','boissons','Boissons',60),
  ('edibles','capsules','Capsules',70),('edibles','pastilles','Pastilles',80),
  ('edibles','chewing-gum','Chewing-gum',90),('edibles','autre','Autre',100),
  ('medicinal','capsules','Capsules',10),('medicinal','huile','Huile',20),
  ('medicinal','spray','Spray',30),('medicinal','tincture','Tincture',40),
  ('medicinal','patch','Patch',50),('medicinal','suppositoire','Suppositoire',60),
  ('medicinal','autre','Autre',70),
  ('topiques','creme','Crème',10),('topiques','baume','Baume',20),
  ('topiques','lotion','Lotion',30),('topiques','huile','Huile',40),
  ('topiques','gel','Gel',50),('topiques','patch','Patch',60),('topiques','autre','Autre',70),
  ('concentres-sans-solvant','dry-sift','Dry Sift',10),
  ('concentres-sans-solvant','static-sift','Static Sift',20),
  ('concentres-sans-solvant','bubble-hash','Bubble Hash',30),
  ('concentres-sans-solvant','ice-water-hash','Ice Water Hash',40),
  ('concentres-sans-solvant','full-melt','Full Melt',50),
  ('concentres-sans-solvant','half-melt','Half Melt',60),
  ('concentres-sans-solvant','piatella','Piatella',70),
  ('concentres-sans-solvant','temple-ball','Temple Ball',80),
  ('concentres-sans-solvant','rosin','Rosin',90),
  ('concentres-sans-solvant','hash-rosin','Hash Rosin',100),
  ('concentres-sans-solvant','flower-rosin','Flower Rosin',110),
  ('concentres-sans-solvant','live-rosin','Live Rosin',120),
  ('concentres-sans-solvant','autre','Autre',130)
) as v(category_slug,slug,name,sort_order)
join public.categories c on c.slug=v.category_slug
on conflict(category_id,slug) do update set name=excluded.name,sort_order=excluded.sort_order,
  is_visible=true,deleted_at=null;

insert into public.dynamic_field_definitions(
  category_id,key,label,description,field_type,unit,is_required,is_filterable,is_searchable,sort_order)
select c.id,v.key,v.label,v.description,v.field_type::public.dynamic_field_type,
  v.unit,v.is_required,v.is_filterable,v.is_searchable,v.sort_order
from (values
  ('fleur','declared_variety','Variété déclarée','Information déclarée par le contributeur','TEXT',null,false,true,true,10),
  ('fleur','declared_producer','Producteur déclaré','Nom déclaré, sans validation commerciale','TEXT',null,false,true,true,20),
  ('fleur','cultivation','Culture','Mode de culture déclaré','SELECT',null,false,true,false,30),
  ('fleur','country','Pays','Pays déclaré','TEXT',null,false,true,true,40),
  ('fleur','region','Région','Région déclarée','TEXT',null,false,true,true,50),
  ('fleur','appearance','Apparence','Description visuelle','LONG_TEXT',null,false,false,true,60),
  ('fleur','density','Densité perçue','Appréciation éditoriale','SELECT',null,false,true,false,70),
  ('fleur','perceived_humidity','Humidité perçue','Appréciation éditoriale','SELECT',null,false,true,false,80),
  ('fleur','aromas','Arômes','Descripteurs aromatiques','MULTI_SELECT',null,false,true,true,90),
  ('fleur','declared_terpenes','Terpènes déclarés','Informations déclarées','MULTI_SELECT',null,false,true,true,100),
  ('fleur','declared_cannabinoids','Cannabinoïdes déclarés','Informations déclarées','LONG_TEXT',null,false,true,true,110),
  ('fleur','lab_report','Rapport d’analyse','Lien HTTPS facultatif','URL',null,false,false,false,120),
  ('fleur','packaging','Emballage','Description de l’emballage','TEXT',null,false,false,true,130),
  ('fleur','batch','Lot','Référence de lot déclarée','TEXT',null,false,false,true,140),
  ('pre-roll','declared_variety','Variété déclarée','Information déclarée','TEXT',null,false,true,true,10),
  ('pre-roll','declared_producer','Producteur déclaré','Information déclarée','TEXT',null,false,true,true,20),
  ('pre-roll','format','Format','Format du pré-roll','SELECT',null,true,true,false,30),
  ('pre-roll','declared_weight','Poids déclaré','Poids indiqué sur l’emballage','NUMBER','g',false,true,false,40),
  ('pre-roll','infused','Infusé déclaré','Indication descriptive','BOOLEAN',null,false,true,false,50),
  ('hash','declared_variety','Variété déclarée','Information déclarée','TEXT',null,false,true,true,10),
  ('hash','declared_producer','Producteur déclaré','Information déclarée','TEXT',null,false,true,true,20),
  ('hash','texture','Texture','Texture perçue','SELECT',null,false,true,false,30),
  ('hash','quality_descriptor','Qualité descriptive','Mention déclarative, sans garantie','SELECT',null,false,true,false,40),
  ('hash','aromas','Arômes','Descripteurs aromatiques','MULTI_SELECT',null,false,true,true,50),
  ('hash','lab_report','Rapport d’analyse','Lien HTTPS facultatif','URL',null,false,false,false,60),
  ('rosin','declared_variety','Variété déclarée','Information déclarée','TEXT',null,false,true,true,10),
  ('rosin','declared_producer','Producteur déclaré','Information déclarée','TEXT',null,false,true,true,20),
  ('rosin','starting_material','Matière de départ','Matière déclarée','SELECT',null,false,true,false,30),
  ('rosin','texture','Texture','Texture déclarée ou perçue','SELECT',null,false,true,false,40),
  ('rosin','lab_report','Rapport d’analyse','Lien HTTPS facultatif','URL',null,false,false,false,50),
  ('extractions-solvants','declared_variety','Variété déclarée','Information déclarée','TEXT',null,false,true,true,10),
  ('extractions-solvants','declared_producer','Producteur déclaré','Information déclarée','TEXT',null,false,true,true,20),
  ('extractions-solvants','extraction_type','Type déclaré','Catégorie descriptive','SELECT',null,true,true,false,30),
  ('extractions-solvants','texture','Texture','Texture déclarée ou perçue','SELECT',null,false,true,false,40),
  ('extractions-solvants','declared_cannabinoids','Cannabinoïdes déclarés','Informations déclarées','LONG_TEXT',null,false,true,true,50),
  ('extractions-solvants','lab_report','Rapport d’analyse','Lien HTTPS facultatif','URL',null,false,false,false,60),
  ('vape','format','Format','Format du dispositif','SELECT',null,true,true,false,10),
  ('vape','extract_type','Type d’extrait déclaré','Information déclarée','SELECT',null,false,true,false,20),
  ('vape','declared_capacity','Capacité déclarée','Capacité indiquée','NUMBER','ml',false,true,false,30),
  ('vape','declared_cannabinoids','Cannabinoïdes déclarés','Informations déclarées','LONG_TEXT',null,false,true,true,40),
  ('vape','lab_report','Rapport d’analyse','Lien HTTPS facultatif','URL',null,false,false,false,50),
  ('edibles','format','Format','Format comestible','SELECT',null,true,true,false,10),
  ('edibles','declared_composition','Composition déclarée','Informations de l’emballage','LONG_TEXT',null,false,true,true,20),
  ('edibles','declared_cannabinoids','Cannabinoïdes déclarés','Informations déclarées','LONG_TEXT',null,false,true,true,30),
  ('edibles','servings','Portions déclarées','Nombre déclaré','NUMBER',null,false,true,false,40),
  ('edibles','allergens','Allergènes déclarés','Informations déclarées','LONG_TEXT',null,false,false,true,50),
  ('medicinal','format','Format','Format déclaré','SELECT',null,true,true,false,10),
  ('medicinal','declared_composition','Composition déclarée','Information descriptive','LONG_TEXT',null,false,true,true,20),
  ('medicinal','declared_cannabinoids','Cannabinoïdes déclarés','Informations déclarées','LONG_TEXT',null,false,true,true,30),
  ('medicinal','lab_report','Rapport d’analyse','Lien HTTPS facultatif','URL',null,false,false,false,40),
  ('topiques','format','Format','Format topique','SELECT',null,true,true,false,10),
  ('topiques','declared_composition','Composition déclarée','Information descriptive','LONG_TEXT',null,false,true,true,20),
  ('topiques','texture','Texture','Description de texture','TEXT',null,false,true,true,30),
  ('concentres-sans-solvant','concentrate_type','Type','Type de concentré','SELECT',null,true,true,false,10),
  ('concentres-sans-solvant','declared_variety','Variété déclarée','Information déclarée','TEXT',null,false,true,true,20),
  ('concentres-sans-solvant','texture','Texture','Texture déclarée ou perçue','SELECT',null,false,true,false,30),
  ('concentres-sans-solvant','quality_descriptor','Qualité descriptive','Mention déclarative, sans garantie','SELECT',null,false,true,false,40)
) as v(category_slug,key,label,description,field_type,unit,is_required,is_filterable,is_searchable,sort_order)
join public.categories c on c.slug=v.category_slug
on conflict do nothing;

insert into public.dynamic_field_options(field_definition_id,value,label,sort_order)
select d.id,v.value,v.label,v.sort_order
from (values
  ('fleur','cultivation','indoor','Indoor',10),('fleur','cultivation','greenhouse','Greenhouse',20),
  ('fleur','cultivation','outdoor','Outdoor',30),('fleur','cultivation','light-assisted','Light Assisted',40),
  ('fleur','density','airy','Aérée',10),('fleur','density','balanced','Équilibrée',20),
  ('fleur','density','dense','Dense',30),('fleur','perceived_humidity','dry','Sèche',10),
  ('fleur','perceived_humidity','balanced','Équilibrée',20),('fleur','perceived_humidity','humid','Humide',30),
  ('pre-roll','format','joint','Joint',10),('pre-roll','format','cone','Cone',20),
  ('pre-roll','format','blunt','Blunt',30),('pre-roll','format','infused','Infused',40),
  ('pre-roll','format','hash-hole','Hash Hole',50),('pre-roll','format','donut','Donut',60),
  ('hash','texture','sandy','Sableuse',10),('hash','texture','pliable','Malléable',20),
  ('hash','texture','greasy','Grasse',30),('hash','texture','resinous','Résineuse',40),
  ('hash','quality_descriptor','food-grade','Food Grade',10),
  ('hash','quality_descriptor','half-melt','Half Melt',20),
  ('hash','quality_descriptor','full-melt','Full Melt',30),
  ('hash','quality_descriptor','five-star','5★',40),
  ('hash','quality_descriptor','six-star','6★',50),
  ('rosin','starting_material','flower','Fleur',10),('rosin','starting_material','hash','Hash',20),
  ('rosin','starting_material','live','Matière fraîche déclarée',30),
  ('rosin','texture','fresh-press','Fresh Press',10),('rosin','texture','cold-cure','Cold Cure',20),
  ('rosin','texture','warm-cure','Warm Cure',30),('rosin','texture','jam','Jam',40),
  ('rosin','texture','badder','Badder',50),('rosin','texture','batter','Batter',60),
  ('rosin','texture','whipped','Whipped',70),('rosin','texture','coins','Coins',80),
  ('rosin','texture','thumbprint','Thumbprint',90),
  ('rosin','texture','full-spec','Full Spec',100),
  ('rosin','texture','single-micron','Single Micron',110),
  ('rosin','texture','mixed-micron','Mixed Micron',120),
  ('extractions-solvants','extraction_type','live-resin','Live Resin',10),
  ('extractions-solvants','extraction_type','cured-resin','Cured Resin',20),
  ('extractions-solvants','extraction_type','distillate','Distillate',30),
  ('extractions-solvants','extraction_type','isolate','Isolate',40),
  ('extractions-solvants','texture','sauce','Sauce',10),
  ('extractions-solvants','texture','diamonds','Diamonds',20),
  ('extractions-solvants','texture','wax','Wax',30),('extractions-solvants','texture','shatter','Shatter',40),
  ('vape','format','cartridge-510','Cartridge 510',10),('vape','format','disposable','Disposable',20),
  ('vape','format','pod','Pod',30),('vape','extract_type','live-resin','Live Resin',10),
  ('vape','extract_type','live-rosin','Live Rosin',20),('vape','extract_type','distillate','Distillate',30),
  ('vape','extract_type','full-spectrum','Full Spectrum',40),
  ('vape','extract_type','broad-spectrum','Broad Spectrum',50),
  ('edibles','format','gummies','Gummies',10),('edibles','format','chocolat','Chocolat',20),
  ('edibles','format','bonbons','Bonbons',30),('edibles','format','cookies','Cookies',40),
  ('edibles','format','boissons','Boissons',50),('edibles','format','capsules','Capsules',60),
  ('medicinal','format','capsules','Capsules',10),('medicinal','format','huile','Huile',20),
  ('medicinal','format','spray','Spray',30),('medicinal','format','tincture','Tincture',40),
  ('medicinal','format','patch','Patch',50),
  ('topiques','format','creme','Crème',10),('topiques','format','baume','Baume',20),
  ('topiques','format','lotion','Lotion',30),('topiques','format','huile','Huile',40),
  ('topiques','format','gel','Gel',50),('topiques','format','patch','Patch',60),
  ('concentres-sans-solvant','concentrate_type','dry-sift','Dry Sift',10),
  ('concentres-sans-solvant','concentrate_type','static-sift','Static Sift',20),
  ('concentres-sans-solvant','concentrate_type','bubble-hash','Bubble Hash',30),
  ('concentres-sans-solvant','concentrate_type','rosin','Rosin',40),
  ('concentres-sans-solvant','texture','sandy','Sableuse',10),
  ('concentres-sans-solvant','texture','resinous','Résineuse',20),
  ('concentres-sans-solvant','texture','cured','Cured',30),
  ('concentres-sans-solvant','quality_descriptor','food-grade','Food Grade',10),
  ('concentres-sans-solvant','quality_descriptor','half-melt','Half Melt',20),
  ('concentres-sans-solvant','quality_descriptor','full-melt','Full Melt',30)
) as v(category_slug,field_key,value,label,sort_order)
join public.categories c on c.slug=v.category_slug
join public.dynamic_field_definitions d on d.category_id=c.id and d.subcategory_id is null
  and d.key=v.field_key
on conflict(field_definition_id,value) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=true;

insert into public.micron_presets(
  slug,mode,label,single_value,minimum_value,maximum_value,multiple_values,is_full_spectrum,is_mixed_micron,sort_order)
values
  ('not-specified','NONE','Non précisé',null,null,null,null,false,false,0),
  ('15-um','SINGLE','15 µm',15,null,null,null,false,false,10),
  ('25-um','SINGLE','25 µm',25,null,null,null,false,false,20),
  ('37-um','SINGLE','37 µm',37,null,null,null,false,false,30),
  ('45-um','SINGLE','45 µm',45,null,null,null,false,false,40),
  ('73-um','SINGLE','73 µm',73,null,null,null,false,false,50),
  ('90-um','SINGLE','90 µm',90,null,null,null,false,false,60),
  ('120-um','SINGLE','120 µm',120,null,null,null,false,false,70),
  ('150-um','SINGLE','150 µm',150,null,null,null,false,false,80),
  ('160-um','SINGLE','160 µm',160,null,null,null,false,false,90),
  ('190-um','SINGLE','190 µm',190,null,null,null,false,false,100),
  ('220-um','SINGLE','220 µm',220,null,null,null,false,false,110),
  ('73-90-um','RANGE','73–90 µm',null,73,90,null,false,false,120),
  ('90-120-um','RANGE','90–120 µm',null,90,120,null,false,false,130),
  ('45-73-um','RANGE','45–73 µm',null,45,73,null,false,false,140),
  ('45-159-um','RANGE','45–159 µm',null,45,159,null,false,false,150),
  ('73-159-um','RANGE','73–159 µm',null,73,159,null,false,false,160),
  ('90-119-um','RANGE','90–119 µm',null,90,119,null,false,false,170),
  ('full-spectrum','FULL_SPECTRUM','Full Spectrum',null,null,null,null,true,false,180),
  ('mixed-micron','MIXED','Mixed Micron',null,null,null,null,false,true,190)
on conflict(slug) do update set mode=excluded.mode,label=excluded.label,
  single_value=excluded.single_value,minimum_value=excluded.minimum_value,
  maximum_value=excluded.maximum_value,multiple_values=excluded.multiple_values,
  is_full_spectrum=excluded.is_full_spectrum,is_mixed_micron=excluded.is_mixed_micron,
  sort_order=excluded.sort_order,is_active=true;

insert into public.rating_criteria(
  key,label,description,minimum_score,maximum_score,weight,is_required,sort_order,is_active)
values
  ('appearance','Apparence','Appréciation visuelle éditoriale',0,10,1,false,10,true),
  ('aroma','Arômes','Appréciation aromatique éditoriale',0,10,1,false,20,true),
  ('texture','Texture','Appréciation de texture éditoriale',0,10,1,false,30,true),
  ('flavor','Profil perçu','Appréciation sensorielle déclarée',0,10,1,false,40,true),
  ('overall_experience','Expérience globale','Appréciation générale du contributeur',0,10,2,true,50,true)
on conflict(key) do update set label=excluded.label,description=excluded.description,
  minimum_score=excluded.minimum_score,maximum_score=excluded.maximum_score,
  weight=excluded.weight,is_required=excluded.is_required,sort_order=excluded.sort_order,is_active=true;

insert into public.app_settings(key,value,value_type,description,is_public) values
  ('APP_DISPLAY_NAME','"Pokédex"'::jsonb,'STRING','Nom public de l’application',true),
  ('APP_TIMEZONE','"Europe/Zurich"'::jsonb,'STRING','Fuseau des classements et publications',true),
  ('ENTRY_VIEW_DEDUP_HOURS','6'::jsonb,'NUMBER','Fenêtre de déduplication des vues',false),
  ('AGE_GATE_ENABLED','true'::jsonb,'BOOLEAN','Active l’avertissement d’âge',true),
  ('MINIMUM_AGE','18'::jsonb,'NUMBER','Âge minimum affiché',true),
  ('VOCABULARY','{"catalogue":"Pokédex","entry":"Capture","contributor":"Dresseur","add":"Capturer","search":"Scanner"}'::jsonb,
    'JSON','Vocabulaire ludique configurable',true)
on conflict(key) do nothing;

insert into public.badges(slug,name,description,icon,kind,criteria,is_active,sort_order) values
  ('trainer-of-the-week','Dresseur de la semaine','Première place hebdomadaire','🥇','ACTIVE',
    '{"ranking":"trainer","period":"week","rank":1}'::jsonb,true,10),
  ('trainer-of-the-month','Dresseur du mois','Première place mensuelle','🏆','HISTORICAL',
    '{"ranking":"trainer","period":"month","rank":1}'::jsonb,true,20),
  ('top-trainer','Top Dresseur','Classement général remarquable','👑','PERMANENT',
    '{"ranking":"trainer","period":"all","maxRank":10}'::jsonb,true,30),
  ('capture-streak','Série de captures','Série de captures publiées','🔥','ACTIVE',
    '{"event":"published_entries","streak":3}'::jsonb,true,40)
on conflict(slug) do update set name=excluded.name,description=excluded.description,
  icon=excluded.icon,kind=excluded.kind,criteria=excluded.criteria,is_active=true,sort_order=excluded.sort_order;

insert into public.home_sections(key,title,is_enabled,sort_order,config) values
  ('banner','Bannière Pokédex',true,10,'{}'),('scanner','Scanner',true,20,'{}'),
  ('latest','Dernières captures',true,30,'{"limit":8}'),
  ('popular','Captures populaires',true,40,'{"limit":8}'),
  ('most-viewed','Les plus vues',true,50,'{"limit":8}'),
  ('most-liked','Les plus aimées',true,60,'{"limit":8}'),
  ('best-rated','Les mieux notées',true,70,'{"limit":8}'),
  ('categories','Catégories',true,80,'{}'),
  ('top-trainers','Top Dresseurs de la semaine',true,90,'{"limit":5}'),
  ('featured-partner','Partenaire à la une',true,100,'{}'),
  ('partners','Partenaires',true,110,'{"limit":4}'),
  ('recent-contributors','Contributeurs récents',true,120,'{"limit":6}'),
  ('socials','Communauté',true,130,'{}'),('add-capture','Proposer une capture',true,140,'{}')
on conflict(key) do nothing;

insert into public.partner_categories(kind,slug,name,description,sort_order,is_active) values
  ('COMMUNITY','communaute','Communauté','Communautés éditoriales',10,true),
  ('MEDIA','media','Média','Médias et publications',20,true),
  ('CREATOR','createur','Créateur','Créateurs de contenu',30,true),
  ('EVENT','evenement','Événement','Événements informatifs',40,true),
  ('ASSOCIATION','association','Association','Associations',50,true),
  ('BRAND','marque','Marque','Marques présentées sans offre de vente',60,true),
  ('OTHER','autre','Autre','Autres partenaires',70,true)
on conflict(slug) do update set kind=excluded.kind,name=excluded.name,
  description=excluded.description,sort_order=excluded.sort_order,is_active=true;

insert into public.users(
  id,account_kind,is_system,telegram_id,display_name,public_slug,role,profile_title,bio,profile_visibility)
values(
  '00000000-0000-4000-8000-000000000001','SYSTEM',true,null,
  'Équipe éditoriale Pokédex','pokedex-editorial-system','EDITOR','Équipe éditoriale',
  'Compte système attribuant les fiches de démonstration éditoriale.','PUBLIC')
on conflict(id) do nothing;

insert into public.entries(
  id,slug,name,short_description,full_description,category_id,subcategory_id,rarity,status,
  is_demo,seed_key,created_by_id,original_contributor_id,approved_by_id,published_by_id,
  created_at,updated_at,approved_at,published_at)
select v.id::uuid,v.slug,v.name,v.short_description,
  v.full_description,c.id,s.id,'COMMON'::public.entry_rarity,'PUBLISHED'::public.entry_status,
  true,v.seed_key,'00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  v.published_at::timestamptz,v.published_at::timestamptz,
  v.published_at::timestamptz,v.published_at::timestamptz
from (values
  ('10000000-0000-4000-8000-000000000001','demo.flower.indoor','demo-fleur-indoor','Démonstration — Fleur Indoor',
    'Exemple éditorial générique d’une fleur cultivée en intérieur.',
    'Fiche de démonstration sans marque ni offre commerciale. Les caractéristiques sont illustratives et doivent être remplacées par des informations vérifiées.','fleur','indoor','2026-01-02 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000002','demo.flower.outdoor','demo-fleur-outdoor','Démonstration — Fleur Outdoor',
    'Exemple éditorial générique d’une fleur cultivée en extérieur.',
    'Contenu de démonstration purement descriptif, sans identité commerciale ni allégation sur un produit réel.','fleur','outdoor','2026-01-03 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000003','demo.pre-roll.joint','demo-pre-roll-joint','Démonstration — Pré-roll Joint',
    'Présentation générique d’un format joint.',
    'Fiche éditoriale de démonstration. Aucun vendeur, prix, dosage réel ou possibilité de commande n’est associé.','pre-roll','joint','2026-01-04 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000004','demo.pre-roll.cone','demo-pre-roll-cone','Démonstration — Pré-roll Cone',
    'Présentation générique d’un format cone.',
    'Exemple destiné à illustrer la structure du catalogue, sans constituer une recommandation ni une offre.','pre-roll','cone','2026-01-05 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000005','demo.hash.dry-sift','demo-hash-dry-sift','Démonstration — Hash Dry Sift',
    'Exemple générique de fiche Dry Sift.',
    'Les descriptions de qualité et de microns sont uniquement illustratives et ne garantissent aucune caractéristique réelle.','hash','dry-sift','2026-01-06 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000006','demo.hash.bubble-hash','demo-hash-bubble-hash','Démonstration — Bubble Hash',
    'Exemple générique de fiche Bubble Hash.',
    'Fiche de démonstration informative sans marque, provenance commerciale ou procédure de fabrication.','hash','bubble-hash','2026-01-07 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000007','demo.rosin.flower','demo-rosin-flower','Démonstration — Flower Rosin',
    'Exemple éditorial générique de Flower Rosin.',
    'Cette découverte fictive illustre les champs de texture et de matière déclarée, sans produit réel associé.','rosin','flower-rosin','2026-01-08 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000008','demo.rosin.hash','demo-rosin-hash','Démonstration — Hash Rosin',
    'Exemple éditorial générique de Hash Rosin.',
    'Contenu fictif de démonstration, sans marque, vente, méthode de production ou garantie analytique.','rosin','hash-rosin','2026-01-09 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000009','demo.solvent.live-resin','demo-extraction-live-resin','Démonstration — Live Resin',
    'Exemple de classement éditorial dans les extractions avec solvants.',
    'Cette fiche illustre uniquement la taxonomie. Elle ne fournit aucune procédure de fabrication ni offre commerciale.','extractions-solvants','live-resin','2026-01-10 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000010','demo.solvent.shatter','demo-extraction-shatter','Démonstration — Shatter',
    'Exemple générique d’un format Shatter.',
    'Contenu fictif et descriptif destiné à éviter un catalogue vide, sans conseil de fabrication ou donnée commerciale.','extractions-solvants','shatter','2026-01-11 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000011','demo.vape.cartridge','demo-vape-cartridge-510','Démonstration — Cartridge 510',
    'Exemple générique d’une fiche de format cartridge.',
    'Fiche de démonstration sans fabricant, capacité réelle, prix ou lien d’achat.','vape','cartridge-510','2026-01-12 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000012','demo.vape.disposable','demo-vape-disposable','Démonstration — Disposable',
    'Exemple générique d’une fiche de format disposable.',
    'Présentation éditoriale fictive, sans recommandation, offre commerciale ou caractéristique garantie.','vape','disposable','2026-01-13 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000013','demo.edibles.gummies','demo-edibles-gummies','Démonstration — Gummies',
    'Exemple générique d’un format comestible.',
    'Aucun dosage réel ni conseil de consommation : cette fiche sert uniquement de démonstration de catalogue.','edibles','gummies','2026-01-14 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000014','demo.edibles.drink','demo-edibles-boisson','Démonstration — Boisson',
    'Exemple générique d’un format boisson.',
    'Fiche fictive sans composition réelle, dosage, marque, prix ou disponibilité commerciale.','edibles','boissons','2026-01-15 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000015','demo.medicinal.oil','demo-medicinal-huile','Démonstration — Huile médicinale',
    'Exemple descriptif d’un format huile.',
    'Les informations sont fictives et ne remplacent en aucun cas un avis médical ou pharmaceutique.','medicinal','huile','2026-01-16 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000016','demo.medicinal.capsules','demo-medicinal-capsules','Démonstration — Capsules médicinales',
    'Exemple descriptif d’un format capsules.',
    'Contenu de démonstration sans posologie, allégation thérapeutique ni produit réel. Demander conseil à un professionnel de santé.','medicinal','capsules','2026-01-17 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000017','demo.topical.cream','demo-topique-creme','Démonstration — Crème topique',
    'Exemple générique d’un format crème.',
    'Présentation fictive sans composition réelle, indication médicale ou offre commerciale.','topiques','creme','2026-01-18 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000018','demo.topical.balm','demo-topique-baume','Démonstration — Baume topique',
    'Exemple générique d’un format baume.',
    'Fiche éditoriale fictive servant à illustrer le catalogue, sans conseil médical ni marque.','topiques','baume','2026-01-19 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000019','demo.solventless.static','demo-concentre-static-sift','Démonstration — Static Sift',
    'Exemple générique d’un concentré sans solvant.',
    'Les caractéristiques sont illustratives. Aucun procédé de fabrication, vendeur ou produit réel n’est présenté.','concentres-sans-solvant','static-sift','2026-01-20 12:00:00+00'),
  ('10000000-0000-4000-8000-000000000020','demo.solventless.live-rosin','demo-concentre-live-rosin','Démonstration — Live Rosin',
    'Exemple générique d’un concentré Live Rosin.',
    'Contenu éditorial fictif, sans marque, méthode détaillée, prix, commande ou garantie de composition.','concentres-sans-solvant','live-rosin','2026-01-21 12:00:00+00')
) as v(id,seed_key,slug,name,short_description,full_description,category_slug,subcategory_slug,published_at)
join public.categories c on c.slug=v.category_slug
join public.subcategories s on s.category_id=c.id and s.slug=v.subcategory_slug
where not exists(select 1 from public.entries e where e.seed_key=v.seed_key)
on conflict do nothing;

-- Views expose safe profile/settings columns while raw Telegram ids stay private.
create or replace view public.public_user_profiles with(security_barrier=true,security_invoker=true) as
select u.id,u.public_slug,u.telegram_username,u.display_name,u.profile_photo_url,u.profile_title,
  u.bio,u.experience_points,u.level,u.featured_entry_id,u.created_at,u.last_seen_at,
  (select count(*)::bigint from public.entries e where e.original_contributor_id=u.id
    and e.status='PUBLISHED' and e.deleted_at is null) capture_count,
  (select count(*)::bigint from public.reviews r where r.user_id=u.id
    and r.status='PUBLISHED' and r.deleted_at is null) published_review_count
from public.users u
where u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED';
create or replace view public.public_user_badges with(security_barrier=true,security_invoker=true) as
select ub.user_id,b.slug,b.name,b.description,b.icon,b.kind,ub.is_active,
  ub.active_from,ub.active_until,ub.awarded_at
from public.user_badges ub join public.badges b on b.id=ub.badge_id
join public.users u on u.id=ub.user_id
where b.is_active and ub.revoked_at is null and u.profile_visibility='PUBLIC'
  and not u.is_banned and u.role<>'BANNED';
create or replace view public.public_app_settings with(security_barrier=true,security_invoker=true) as
select key,value,value_type,description,updated_at from public.app_settings where is_public;
create or replace view public.published_entries with(security_barrier=true,security_invoker=true) as
select e.* from public.entries e where e.status='PUBLISHED' and e.deleted_at is null;
create or replace view public.featured_partners with(security_barrier=true,security_invoker=true) as
select p.* from public.partners p where p.is_active and p.is_featured and p.deleted_at is null
  and (p.featured_from is null or p.featured_from<=now())
  and (p.featured_until is null or p.featured_until>now());

-- RLS defaults every table to private. Only explicitly published rows are readable
-- through Supabase's public API. No anon/authenticated write policy is created.
do $$ declare table_name text; begin
  foreach table_name in array array[
    'users','user_profile_settings','permissions','role_permissions','badges','user_badges',
    'user_experience_events','categories','subcategories','tags','taxonomy_aliases',
    'dynamic_field_definitions','dynamic_field_options','entries','entry_images','entry_revisions',
    'entry_view_events','entry_likes','entry_field_values','micron_specifications','micron_presets',
    'entry_tags','rating_criteria','reviews','review_versions','ratings','favorites',
    'user_collections','collection_entries','submissions','submission_changes','partner_categories',
    'partners','partner_click_events','reports','report_attachments','admin_messages',
    'admin_message_attachments','audit_logs','app_settings','home_sections','telegram_publications',
    'bot_conversation_states','telegram_auth_replays','telegram_update_receipts','rate_limit_buckets'
  ] loop execute format('alter table public.%I enable row level security',table_name); end loop;
end $$;

drop policy if exists public_profiles_read on public.users;
create policy public_profiles_read on public.users for select to anon,authenticated
  using(profile_visibility='PUBLIC' and not is_banned and role<>'BANNED');
drop policy if exists public_badges_read on public.badges;
create policy public_badges_read on public.badges for select to anon,authenticated using(is_active);
drop policy if exists public_user_badges_read on public.user_badges;
create policy public_user_badges_read on public.user_badges for select to anon,authenticated
  using(is_active and revoked_at is null and exists(select 1 from public.users u
    where u.id=user_id and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED'));
drop policy if exists public_categories_read on public.categories;
create policy public_categories_read on public.categories for select to anon,authenticated
  using(is_visible and deleted_at is null);
drop policy if exists public_subcategories_read on public.subcategories;
create policy public_subcategories_read on public.subcategories for select to anon,authenticated
  using(is_visible and deleted_at is null and exists(select 1 from public.categories c
    where c.id=category_id and c.is_visible and c.deleted_at is null));
drop policy if exists public_tags_read on public.tags;
create policy public_tags_read on public.tags for select to anon,authenticated using(is_active);
drop policy if exists public_taxonomy_aliases_read on public.taxonomy_aliases;
create policy public_taxonomy_aliases_read on public.taxonomy_aliases for select to anon,authenticated using(is_active);
drop policy if exists public_dynamic_fields_read on public.dynamic_field_definitions;
create policy public_dynamic_fields_read on public.dynamic_field_definitions for select to anon,authenticated
  using(is_visible and deleted_at is null);
drop policy if exists public_dynamic_options_read on public.dynamic_field_options;
create policy public_dynamic_options_read on public.dynamic_field_options for select to anon,authenticated
  using(is_active and exists(select 1 from public.dynamic_field_definitions d
    where d.id=field_definition_id and d.is_visible and d.deleted_at is null));
drop policy if exists public_entries_read on public.entries;
create policy public_entries_read on public.entries for select to anon,authenticated
  using(status='PUBLISHED' and deleted_at is null);
drop policy if exists public_entry_images_read on public.entry_images;
create policy public_entry_images_read on public.entry_images for select to anon,authenticated
  using(storage_bucket='entry-images' and deleted_at is null and exists(select 1 from public.entries e
    where e.id=entry_id and e.status='PUBLISHED' and e.deleted_at is null));
drop policy if exists public_entry_fields_read on public.entry_field_values;
create policy public_entry_fields_read on public.entry_field_values for select to anon,authenticated
  using(exists(select 1 from public.entries e where e.id=entry_id
    and e.status='PUBLISHED' and e.deleted_at is null));
drop policy if exists public_micron_specs_read on public.micron_specifications;
create policy public_micron_specs_read on public.micron_specifications for select to anon,authenticated
  using(exists(select 1 from public.entries e where e.id=entry_id
    and e.status='PUBLISHED' and e.deleted_at is null));
drop policy if exists public_micron_presets_read on public.micron_presets;
create policy public_micron_presets_read on public.micron_presets for select to anon,authenticated using(is_active);
drop policy if exists public_entry_tags_read on public.entry_tags;
create policy public_entry_tags_read on public.entry_tags for select to anon,authenticated
  using(exists(select 1 from public.entries e where e.id=entry_id
    and e.status='PUBLISHED' and e.deleted_at is null));
drop policy if exists public_rating_criteria_read on public.rating_criteria;
create policy public_rating_criteria_read on public.rating_criteria for select to anon,authenticated using(is_active);
drop policy if exists public_reviews_read on public.reviews;
create policy public_reviews_read on public.reviews for select to anon,authenticated
  using(status='PUBLISHED' and deleted_at is null and exists(select 1 from public.entries e
    where e.id=entry_id and e.status='PUBLISHED' and e.deleted_at is null));
drop policy if exists public_ratings_read on public.ratings;
create policy public_ratings_read on public.ratings for select to anon,authenticated
  using(exists(select 1 from public.reviews r join public.entries e on e.id=r.entry_id
    where r.id=review_id and r.status='PUBLISHED' and r.deleted_at is null
      and e.status='PUBLISHED' and e.deleted_at is null));
drop policy if exists public_partner_categories_read on public.partner_categories;
create policy public_partner_categories_read on public.partner_categories for select to anon,authenticated using(is_active);
drop policy if exists public_partners_read on public.partners;
create policy public_partners_read on public.partners for select to anon,authenticated
  using(is_active and deleted_at is null);
drop policy if exists public_home_sections_read on public.home_sections;
create policy public_home_sections_read on public.home_sections for select to anon,authenticated using(is_enabled);
drop policy if exists public_app_settings_read on public.app_settings;
create policy public_app_settings_read on public.app_settings for select to anon,authenticated using(is_public);

-- Explicit Data API surface. Telegram identities and all writes remain server-only.
revoke all privileges on all tables in schema public from anon,authenticated;
revoke all privileges on all sequences in schema public from anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
alter default privileges in schema public revoke all on tables from anon,authenticated;
alter default privileges in schema public revoke all on sequences from anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;

grant usage on schema public to anon,authenticated,service_role;
grant usage on schema extensions to service_role;
grant select on public.badges,public.categories,public.subcategories,public.tags,
  public.taxonomy_aliases,public.dynamic_field_definitions,public.dynamic_field_options,
  public.entries,public.entry_images,public.entry_field_values,public.micron_specifications,
  public.micron_presets,public.entry_tags,public.rating_criteria,public.reviews,public.ratings,
  public.partner_categories,public.partners,public.home_sections,public.app_settings
  to anon,authenticated;
grant select(id,public_slug,telegram_username,display_name,profile_photo_url,profile_title,bio,
  experience_points,level,featured_entry_id,profile_visibility,is_banned,role,created_at,last_seen_at)
  on public.users to anon,authenticated;
grant select(user_id,badge_id,is_active,active_from,active_until,awarded_at,revoked_at)
  on public.user_badges to anon,authenticated;
grant select on public.public_user_profiles,public.public_user_badges,public.public_app_settings,
  public.published_entries,public.featured_partners to anon,authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- Storage buckets. Public buckets contain only promoted/published media. Draft,
-- moderation and message assets remain private; service_role is the sole writer.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('entry-images','entry-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('entry-drafts','entry-drafts',false,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('partner-images','partner-images',true,8388608,array['image/jpeg','image/png','image/webp','image/avif']),
  ('partner-drafts','partner-drafts',false,8388608,array['image/jpeg','image/png','image/webp','image/avif']),
  ('profile-images','profile-images',true,5242880,array['image/jpeg','image/png','image/webp','image/avif']),
  ('app-assets','app-assets',true,5242880,array['image/jpeg','image/png','image/webp','image/avif']),
  ('message-attachments','message-attachments',false,8388608,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set name=excluded.name,public=excluded.public,
  file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists public_published_media_read on storage.objects;
-- Public buckets are read through their public object URLs. No INSERT, UPDATE or
-- DELETE policy is created on storage.objects: uploads and promotions use service_role.

commit;
