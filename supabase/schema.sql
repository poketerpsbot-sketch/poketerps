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
create or replace function public.sync_user_role_badge() returns trigger language plpgsql
security definer set search_path='' as $$
declare desired_slug text; desired_badge_id uuid;
begin
  desired_slug:=case new.role::text
    when 'OWNER' then 'role-owner'
    when 'ADMIN' then 'role-admin'
    when 'MODERATOR' then 'role-moderator'
    when 'EDITOR' then 'role-editor'
    else null end;
  update public.user_badges ub set
    is_active=false,revoked_at=coalesce(ub.revoked_at,now()),
    revoke_reason='Rôle Telegram modifié',
    metadata=ub.metadata||jsonb_build_object('source','role-sync','revokedForRole',new.role::text)
  from public.badges b
  where ub.user_id=new.id and ub.badge_id=b.id
    and b.slug in ('role-owner','role-admin','role-moderator','role-editor')
    and (desired_slug is null or b.slug<>desired_slug)
    and ub.is_active and ub.revoked_at is null;
  if desired_slug is null then return new; end if;
  select b.id into desired_badge_id from public.badges b
    where b.slug=desired_slug and b.is_active;
  if desired_badge_id is null then return new; end if;
  update public.user_badges ub set
    active_from=coalesce(least(ub.active_from,now()),now()),active_until=null,
    metadata=ub.metadata||jsonb_build_object(
      'source','role-sync','role',new.role::text,'automatic',true)
  where ub.user_id=new.id and ub.badge_id=desired_badge_id
    and ub.is_active and ub.revoked_at is null;
  if not found then
    insert into public.user_badges(user_id,badge_id,is_active,active_from,metadata)
    values(new.id,desired_badge_id,true,now(),jsonb_build_object(
      'source','role-sync','role',new.role::text,'automatic',true));
  end if;
  return new;
end $$;
revoke all on function public.sync_user_role_badge() from public,anon,authenticated;
grant execute on function public.sync_user_role_badge() to service_role;
drop trigger if exists sync_user_role_badge on public.users;
create trigger sync_user_role_badge after insert or update of role on public.users
  for each row execute function public.sync_user_role_badge();
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
  ('vape','declared_capacity','Volume déclaré','Volume indiqué sur l’emballage','NUMBER','mL',false,true,false,30),
  ('vape','declared_cannabinoids','Cannabinoïdes déclarés','Informations déclarées','LONG_TEXT',null,false,true,true,40),
  ('vape','lab_report','Rapport d’analyse','Lien HTTPS facultatif','URL',null,false,false,false,50),
  ('edibles','format','Format','Format comestible','SELECT',null,true,true,false,10),
  ('edibles','declared_composition','Composition déclarée','Informations de l’emballage','LONG_TEXT',null,false,true,true,20),
  ('edibles','declared_cannabinoids','Cannabinoïdes déclarés','Informations déclarées','LONG_TEXT',null,false,true,true,30),
  ('edibles','servings','Portions déclarées','Nombre déclaré','NUMBER',null,false,true,false,40),
  ('edibles','allergens','Allergènes déclarés','Informations déclarées','LONG_TEXT',null,false,false,true,50),
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

-- Product measurements use the unit printed on the label or analysis. Micron
-- data remains in micron_specifications and is only offered for filtered
-- products by the application.
create temporary table pokedex_seed_measurement_fields (
  category_slug text not null, field_key text not null, label text not null,
  description text not null, unit text not null, sort_order integer not null,
  max_value numeric not null, step_value numeric not null,
  primary key(category_slug,field_key)
) on commit drop;

insert into pokedex_seed_measurement_fields
select category.category_slug,field.field_key,field.label,field.description,field.unit,
  category.base_sort + field.sort_offset,field.max_value,field.step_value
from (values
  ('fleur',150),('hash',70),('rosin',60),
  ('extractions-solvants',70),('concentres-sans-solvant',50)
) category(category_slug,base_sort)
cross join (values
  ('declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage.','g',0,100000::numeric,0.01::numeric),
  ('declared_thc_mg_g','THC déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',10,1000::numeric,0.1::numeric),
  ('declared_cbd_mg_g','CBD déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',20,1000::numeric,0.1::numeric),
  ('declared_thc_percent','THC déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',30,100::numeric,0.1::numeric),
  ('declared_cbd_percent','CBD déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',40,100::numeric,0.1::numeric)
) field(field_key,label,description,unit,sort_offset,max_value,step_value);

insert into pokedex_seed_measurement_fields values
  ('pre-roll','declared_weight','Poids net total déclaré','Poids net total indiqué sur l’emballage.','g',60,100000,0.01),
  ('pre-roll','declared_unit_count','Nombre de pré-rolls','Nombre d’unités indiqué sur l’emballage.','unité(s)',70,10000,1),
  ('pre-roll','declared_unit_weight','Poids déclaré par pré-roll','Poids indiqué pour une unité.','g',80,1000,0.01),
  ('pre-roll','declared_thc_per_unit','THC déclaré par pré-roll','Quantité indiquée pour une unité.','mg/unité',90,100000,0.1),
  ('pre-roll','declared_cbd_per_unit','CBD déclaré par pré-roll','Quantité indiquée pour une unité.','mg/unité',100,100000,0.1),
  ('vape','declared_capacity','Volume déclaré','Volume indiqué sur l’emballage.','mL',60,100000,0.01),
  ('vape','declared_fill_weight','Poids de remplissage déclaré','Poids de remplissage indiqué sur l’emballage.','g',70,100000,0.01),
  ('vape','declared_unit_count','Nombre de dispositifs','Nombre d’unités indiqué sur l’emballage.','unité(s)',80,10000,1),
  ('vape','declared_thc_mg_ml','THC déclaré','Concentration indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',90,10000,0.1),
  ('vape','declared_cbd_mg_ml','CBD déclaré','Concentration indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',100,10000,0.1),
  ('edibles','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage pour un produit solide.','g',60,100000,0.01),
  ('edibles','declared_volume','Volume net déclaré','Volume net indiqué sur l’emballage pour une boisson.','mL',70,100000,0.01),
  ('edibles','servings','Nombre d’unités','Nombre d’unités indiqué sur l’emballage.','unité(s)',80,10000,1),
  ('edibles','declared_thc_per_unit','THC déclaré par unité','Quantité indiquée pour une unité.','mg/unité',90,100000,0.1),
  ('edibles','declared_cbd_per_unit','CBD déclaré par unité','Quantité indiquée pour une unité.','mg/unité',100,100000,0.1),
  ('edibles','declared_thc_per_package','THC déclaré par emballage','Quantité totale indiquée pour l’emballage.','mg/emballage',110,1000000,0.1),
  ('edibles','declared_cbd_per_package','CBD déclaré par emballage','Quantité totale indiquée pour l’emballage.','mg/emballage',120,1000000,0.1),
  ('topiques','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage pour un produit solide.','g',40,100000,0.01),
  ('topiques','declared_volume','Volume net déclaré','Volume net indiqué sur l’emballage pour un produit liquide.','mL',50,100000,0.01),
  ('topiques','declared_thc_mg_g','THC déclaré','Concentration massique indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',60,1000,0.1),
  ('topiques','declared_cbd_mg_g','CBD déclaré','Concentration massique indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',70,1000,0.1),
  ('topiques','declared_thc_mg_ml','THC déclaré','Concentration volumique indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',80,10000,0.1),
  ('topiques','declared_cbd_mg_ml','CBD déclaré','Concentration volumique indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',90,10000,0.1);

insert into public.dynamic_field_definitions(
  category_id,key,label,description,field_type,unit,validation_rules,
  is_required,is_filterable,is_searchable,is_visible,sort_order,deleted_at
)
select c.id,v.field_key,v.label,v.description,'NUMBER'::public.dynamic_field_type,v.unit,
  jsonb_build_object('min',0,'max',v.max_value,'step',v.step_value),
  false,true,false,true,v.sort_order,null
from pokedex_seed_measurement_fields v
join public.categories c on c.slug=v.category_slug
on conflict do nothing;

update public.dynamic_field_definitions d
set label=v.label,description=v.description,field_type='NUMBER'::public.dynamic_field_type,
  unit=v.unit,validation_rules=jsonb_build_object('min',0,'max',v.max_value,'step',v.step_value),
  is_filterable=true,is_visible=true,sort_order=v.sort_order,deleted_at=null,updated_at=now()
from pokedex_seed_measurement_fields v
join public.categories c on c.slug=v.category_slug
where d.category_id=c.id and d.subcategory_id is null and d.key=v.field_key;

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
  ('role-owner','Propriétaire','Propriétaire officiel de la communauté','👑','ACTIVE',
    '{"system":"telegram-role","role":"OWNER","automatic":true}'::jsonb,true,1),
  ('role-admin','Administration','Membre de l’équipe d’administration','🛡️','ACTIVE',
    '{"system":"telegram-role","role":"ADMIN","automatic":true}'::jsonb,true,2),
  ('role-moderator','Modération','Membre de l’équipe de modération','🔎','ACTIVE',
    '{"system":"telegram-role","role":"MODERATOR","automatic":true}'::jsonb,true,3),
  ('role-editor','Rédaction','Membre de l’équipe éditoriale','✍️','ACTIVE',
    '{"system":"telegram-role","role":"EDITOR","automatic":true}'::jsonb,true,4),
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

-- Rich, explicitly fictional content for the removable demo catalogue.
alter table public.entry_images
  add column if not exists source_url text,
  add column if not exists credit text,
  add column if not exists license_name text,
  add column if not exists license_url text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='entry_images_attribution_consistency'
      and conrelid='public.entry_images'::regclass
  ) then
    alter table public.entry_images
      add constraint entry_images_attribution_consistency check (
        (source_url is null and credit is null and license_name is null and license_url is null)
        or (
          source_url is not null and char_length(source_url) between 9 and 2048
            and source_url ~ '^https://[^[:space:]]+$'
          and credit is not null and char_length(btrim(credit)) between 1 and 500
          and license_name is not null and char_length(btrim(license_name)) between 1 and 120
          and license_url is not null and char_length(license_url) between 9 and 2048
            and license_url ~ '^https://[^[:space:]]+$'
        )
      );
  end if;
end $$;

do $$
declare
  content record;
  field_item record;
begin
  for content in
    select *
    from jsonb_to_recordset($demo$
    [
      {
        "seed_key": "demo.flower.indoor",
        "short_description": "Fleur indoor fictive aux tons verts et violets, à la structure compacte et au profil aromatique boisé-agrumes.",
        "full_description": "Cette fiche de démonstration illustre la documentation éditoriale d’une fleur classée indoor. Les calices serrés, les pistils ambrés et la couverture de trichomes décrits ici composent un exemple visuel fictif.\n\nAucun cultivar, producteur, lot ou résultat analytique réel n’est associé à cette entrée. Les descripteurs servent uniquement à montrer le niveau de détail attendu dans le catalogue.",
        "declared_variety": "Profil fictif agrumes et pin",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Culture indoor — classification descriptive",
        "texture": "Structure compacte et surface résineuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif agrumes et pin", "display": "Profil fictif agrumes et pin"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "cultivation": {"value": "indoor", "display": "Indoor", "option": "indoor"},
          "appearance": {"value": "Tons verts et violets, pistils ambrés et trichomes visibles — description illustrative.", "display": "Tons verts et violets, pistils ambrés et trichomes visibles — description illustrative."},
          "density": {"value": "dense", "display": "Dense — appréciation illustrative", "option": "dense"},
          "perceived_humidity": {"value": "balanced", "display": "Équilibrée — appréciation illustrative", "option": "balanced"}
        }
      },
      {
        "seed_key": "demo.flower.outdoor",
        "short_description": "Fleur outdoor fictive à la silhouette aérée, aux nuances vert clair et au profil floral-terreux.",
        "full_description": "Cette entrée présente un exemple de fleur classée outdoor, avec une structure ouverte, des feuilles fines et des pistils cuivrés décrits à titre illustratif. Elle montre comment séparer observations visuelles et informations déclarées.\n\nL’origine géographique, la variété, le producteur et la composition ne correspondent à aucun produit réel. La fiche demeure un contenu éditorial fictif destiné à étoffer la navigation.",
        "declared_variety": "Profil fictif floral et terreux",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Culture outdoor — classification descriptive",
        "texture": "Structure aérée et souple — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif floral et terreux", "display": "Profil fictif floral et terreux"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "cultivation": {"value": "outdoor", "display": "Outdoor", "option": "outdoor"},
          "appearance": {"value": "Structure ouverte, vert clair et pistils cuivrés — description illustrative.", "display": "Structure ouverte, vert clair et pistils cuivrés — description illustrative."},
          "density": {"value": "airy", "display": "Aérée — appréciation illustrative", "option": "airy"},
          "perceived_humidity": {"value": "balanced", "display": "Équilibrée — appréciation illustrative", "option": "balanced"}
        }
      },
      {
        "seed_key": "demo.pre-roll.joint",
        "short_description": "Pré-roll fictif au format joint, de forme cylindrique régulière et présenté comme exemple de catalogue.",
        "full_description": "Cette fiche illustre un pré-roll classé au format joint. La forme, le papier clair et le poids déclaré sont des données fictives choisies pour démontrer les champs structurés de la catégorie.\n\nAucun contenu réel, fabricant ou lot n’est représenté. L’entrée ne contient ni recommandation d’usage ni information commerciale.",
        "declared_variety": "Assemblage floral fictif",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Pré-roll joint — classification descriptive",
        "texture": "Papier clair et forme cylindrique — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage floral fictif", "display": "Assemblage floral fictif"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "format": {"value": "joint", "display": "Joint", "option": "joint"},
          "declared_weight": {"value": 0.5, "display": "0,5 g — valeur fictive"},
          "infused": {"value": false, "display": "Non — valeur fictive"}
        }
      },
      {
        "seed_key": "demo.pre-roll.cone",
        "short_description": "Pré-roll fictif au format cone, à la silhouette conique nette et aux données déclarées purement illustratives.",
        "full_description": "Cette entrée montre la variante cone dans la taxonomie des pré-rolls. Sa forme évasée, son papier neutre et son poids déclaré constituent uniquement un jeu de données de démonstration.\n\nAucun contenu, producteur ou conditionnement réel n’est associé à la fiche. Elle ne présente ni mode d’emploi ni offre commerciale.",
        "declared_variety": "Assemblage floral fictif",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Pré-roll cone — classification descriptive",
        "texture": "Papier neutre et forme conique — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage floral fictif", "display": "Assemblage floral fictif"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "format": {"value": "cone", "display": "Cone", "option": "cone"},
          "declared_weight": {"value": 0.7, "display": "0,7 g — valeur fictive"},
          "infused": {"value": false, "display": "Non — valeur fictive"}
        }
      },
      {
        "seed_key": "demo.hash.dry-sift",
        "short_description": "Dry Sift fictif à l’aspect sableux doré, documenté avec des descripteurs visuels non analytiques.",
        "full_description": "Cette fiche de démonstration représente la sous-catégorie Dry Sift par une texture fine, friable et légèrement dorée. Les observations sont volontairement limitées à l’apparence et au classement éditorial.\n\nLa variété, le producteur et le niveau de qualité sont fictifs ou non attribués. Aucun protocole, rendement ou résultat de laboratoire n’est fourni.",
        "declared_variety": "Assemblage fictif à dominante terreuse",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Dry Sift — classification descriptive",
        "texture": "Sableuse et friable — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage fictif à dominante terreuse", "display": "Assemblage fictif à dominante terreuse"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "texture": {"value": "sandy", "display": "Sableuse — appréciation illustrative", "option": "sandy"},
          "aromas": {"value": ["terreux", "boisé", "épicé"], "display": "Terreux, boisé, épicé — descripteurs fictifs"}
        }
      },
      {
        "seed_key": "demo.hash.bubble-hash",
        "short_description": "Bubble Hash fictif à l’aspect résineux brun doré, présenté comme repère visuel de taxonomie.",
        "full_description": "Cette entrée illustre la sous-catégorie Bubble Hash avec une matière granuleuse qui paraît s’agglomérer légèrement. La couleur et la texture sont des observations fictives destinées à remplir une fiche complète.\n\nAucun lot, producteur, grade ou analyse réelle n’est référencé. La classification reste descriptive et ne fournit aucune procédure de préparation.",
        "declared_variety": "Assemblage fictif à dominante boisée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Bubble Hash — classification descriptive",
        "texture": "Résineuse et granuleuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage fictif à dominante boisée", "display": "Assemblage fictif à dominante boisée"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "texture": {"value": "resinous", "display": "Résineuse — appréciation illustrative", "option": "resinous"},
          "aromas": {"value": ["boisé", "floral", "terreux"], "display": "Boisé, floral, terreux — descripteurs fictifs"}
        }
      },
      {
        "seed_key": "demo.rosin.flower",
        "short_description": "Flower Rosin fictif à la teinte ambrée claire et à la texture souple de type Fresh Press.",
        "full_description": "Cette fiche montre comment documenter un rosin dont la matière de départ déclarée est la fleur. La teinte miel, la transparence et la texture souple constituent un exemple éditorial fictif.\n\nAucune origine, composition analytique ou identité de producteur n’est attribuée. Le procédé est seulement nommé pour la classification et n’est pas détaillé.",
        "declared_variety": "Profil floral fictif",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Flower Rosin — classification descriptive",
        "texture": "Souple et ambrée — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil floral fictif", "display": "Profil floral fictif"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "starting_material": {"value": "flower", "display": "Fleur", "option": "flower"},
          "texture": {"value": "fresh-press", "display": "Fresh Press — appréciation illustrative", "option": "fresh-press"}
        }
      },
      {
        "seed_key": "demo.rosin.hash",
        "short_description": "Hash Rosin fictif à la teinte crème dorée et à la texture homogène classée Cold Cure.",
        "full_description": "Cette entrée présente un exemple de Hash Rosin avec une apparence crémeuse, mate et homogène. La matière de départ et la texture sélectionnées servent à illustrer les filtres structurés du catalogue.\n\nIl ne s’agit pas d’un produit identifié : aucune marque, analyse ou origine réelle n’est associée. Aucun paramètre de transformation n’est communiqué.",
        "declared_variety": "Profil fictif fruité et floral",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Hash Rosin — classification descriptive",
        "texture": "Crémeuse et homogène — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif fruité et floral", "display": "Profil fictif fruité et floral"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "starting_material": {"value": "hash", "display": "Hash", "option": "hash"},
          "texture": {"value": "cold-cure", "display": "Cold Cure — appréciation illustrative", "option": "cold-cure"}
        }
      },
      {
        "seed_key": "demo.solvent.live-resin",
        "short_description": "Live Resin fictive à l’apparence brillante et visqueuse, classée dans les extractions avec solvants.",
        "full_description": "Cette fiche illustre une Live Resin à la teinte dorée, avec une phase visuellement fluide et brillante. Ces éléments sont des descripteurs fictifs permettant de présenter les champs propres à la catégorie.\n\nLa matière, le producteur, les solvants et les données analytiques ne sont pas attribués à un produit réel. Aucune procédure ni recommandation n’est fournie.",
        "declared_variety": "Profil fictif agrumes et herbes",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Extraction avec solvant — classification uniquement",
        "texture": "Brillante et visqueuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif agrumes et herbes", "display": "Profil fictif agrumes et herbes"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "extraction_type": {"value": "live-resin", "display": "Live Resin", "option": "live-resin"},
          "texture": {"value": "sauce", "display": "Sauce — appréciation illustrative", "option": "sauce"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.solvent.shatter",
        "short_description": "Shatter fictif sous forme de plaque ambrée translucide, décrit sans donnée de composition réelle.",
        "full_description": "Cette entrée représente la sous-catégorie Shatter par une plaque fine, cassante et translucide aux reflets ambrés. L’exemple sert à démontrer la combinaison du type d’extraction et de la texture.\n\nAucun producteur, lot, composition ou contrôle analytique réel n’est cité. La fiche reste descriptive et ne contient aucun protocole.",
        "declared_variety": "Profil fictif boisé et citronné",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Extraction avec solvant — classification uniquement",
        "texture": "Plaque cassante et translucide — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif boisé et citronné", "display": "Profil fictif boisé et citronné"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "extraction_type": {"value": "cured-resin", "display": "Cured Resin — classification illustrative", "option": "cured-resin"},
          "texture": {"value": "shatter", "display": "Shatter", "option": "shatter"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.vape.cartridge",
        "short_description": "Cartouche 510 fictive au réservoir transparent, utilisée comme illustration neutre du format vape.",
        "full_description": "Cette fiche présente un dispositif générique au format Cartridge 510 avec un petit réservoir transparent et un liquide ambré illustratif. La capacité indiquée permet de démontrer le champ numérique de la catégorie.\n\nAucun fabricant, liquide, composition ou appareil réel n’est identifié. L’entrée ne constitue pas une recommandation d’utilisation.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Cartouche 510 — classification descriptive",
        "texture": "Liquide ambré — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "cartridge-510", "display": "Cartridge 510", "option": "cartridge-510"},
          "extract_type": {"value": "full-spectrum", "display": "Full Spectrum — classification fictive", "option": "full-spectrum"},
          "declared_capacity": {"value": 0.5, "display": "0,5 mL — valeur fictive"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.vape.disposable",
        "short_description": "Dispositif vape jetable fictif au corps compact, présenté comme photo et donnée d’illustration.",
        "full_description": "Cette entrée montre le format Disposable au moyen d’un dispositif compact et neutre. La capacité et le type d’extrait sont des valeurs fictives utilisées pour rendre les filtres de démonstration visibles.\n\nAucune marque, formulation, performance ou provenance réelle n’est associée. La fiche est une classification éditoriale et non un conseil d’utilisation.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Disposable — classification descriptive",
        "texture": "Liquide doré — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "disposable", "display": "Disposable", "option": "disposable"},
          "extract_type": {"value": "broad-spectrum", "display": "Broad Spectrum — classification fictive", "option": "broad-spectrum"},
          "declared_capacity": {"value": 1.0, "display": "1,0 mL — valeur fictive"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.edibles.gummies",
        "short_description": "Confiseries gélifiées fictives aux couleurs fruitées, utilisées comme illustration du format Gummies.",
        "full_description": "Cette fiche illustre le format Gummies avec des formes gélifiées colorées et une composition volontairement générique. Les couleurs, arômes et informations structurées ne décrivent aucun article réel.\n\nAucune teneur, portion, marque ou disponibilité n’est indiquée. L’entrée sert exclusivement d’exemple visuel et taxonomique.",
        "declared_variety": "Composition fruitée fictive",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Gummies — classification descriptive",
        "texture": "Gélifiée et souple — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "gummies", "display": "Gummies", "option": "gummies"},
          "declared_composition": {"value": "Base gélifiée fruitée fictive; composition réelle non renseignée.", "display": "Base gélifiée fruitée fictive; composition réelle non renseignée."},
          "declared_cannabinoids": {"value": "Aucune teneur analytique déclarée — fiche fictive.", "display": "Aucune teneur analytique déclarée — fiche fictive."},
          "allergens": {"value": "Non renseignés — illustration uniquement.", "display": "Non renseignés — illustration uniquement."}
        }
      },
      {
        "seed_key": "demo.edibles.drink",
        "short_description": "Boisson au chanvre fictive à la robe ambrée claire, présentée comme illustration neutre de la catégorie.",
        "full_description": "Cette entrée représente le format Boissons avec une tasse et une infusion ambrée utilisées à titre d’illustration. La composition déclarée reste volontairement générique afin de montrer les champs sans simuler une référence existante.\n\nAucune teneur, portion, marque ou propriété particulière n’est revendiquée. Cette fiche n’est associée à aucun produit consommable réel.",
        "declared_variety": "Infusion fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Boisson — classification descriptive",
        "texture": "Liquide ambré clair — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "boissons", "display": "Boissons", "option": "boissons"},
          "declared_composition": {"value": "Infusion végétale fictive; composition réelle non renseignée.", "display": "Infusion végétale fictive; composition réelle non renseignée."},
          "declared_cannabinoids": {"value": "Aucune teneur analytique déclarée — fiche fictive.", "display": "Aucune teneur analytique déclarée — fiche fictive."},
          "allergens": {"value": "Non renseignés — illustration uniquement.", "display": "Non renseignés — illustration uniquement."}
        }
      },
      {
        "seed_key": "demo.topical.cream",
        "short_description": "Crème topique fictive à la texture légère et homogène, illustrée dans un contenant générique.",
        "full_description": "Cette fiche montre le format Crème dans la catégorie des topiques. La texture claire, l’aspect homogène et le contenant neutre sont des éléments d’illustration sans référence à une formule existante.\n\nAucune composition, indication ou propriété cosmétique ou médicale n’est revendiquée. Aucun fabricant ou article réel n’est associé.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Crème topique — classification descriptive",
        "texture": "Légère et homogène — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "creme", "display": "Crème", "option": "creme"},
          "declared_composition": {"value": "Base crémeuse non spécifiée; composition entièrement fictive.", "display": "Base crémeuse non spécifiée; composition entièrement fictive."},
          "texture": {"value": "Légère, lisse et homogène — appréciation illustrative.", "display": "Légère, lisse et homogène — appréciation illustrative."}
        }
      },
      {
        "seed_key": "demo.topical.balm",
        "short_description": "Baume topique fictif à la texture dense et cireuse, présenté dans un conditionnement neutre.",
        "full_description": "Cette entrée illustre le format Baume avec une matière visuellement dense et un contenant générique. Les caractéristiques servent à différencier ce format de la crème dans les exemples du catalogue.\n\nAucune composition, indication ou propriété cosmétique ou médicale n’est revendiquée. La fiche ne représente aucune référence commercialisée.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Baume topique — classification descriptive",
        "texture": "Dense et cireuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "baume", "display": "Baume", "option": "baume"},
          "declared_composition": {"value": "Base cireuse non spécifiée; composition entièrement fictive.", "display": "Base cireuse non spécifiée; composition entièrement fictive."},
          "texture": {"value": "Dense, cireuse et mate — appréciation illustrative.", "display": "Dense, cireuse et mate — appréciation illustrative."}
        }
      },
      {
        "seed_key": "demo.solventless.static",
        "short_description": "Static Sift fictif à l’aspect poudreux blond, classé parmi les concentrés sans solvant.",
        "full_description": "Cette fiche représente la sous-catégorie Static Sift au moyen d’une matière fine, claire et visuellement homogène. Les descripteurs sont fictifs et servent à rendre les filtres de la catégorie compréhensibles.\n\nAucun grade, rendement, lot ou producteur réel n’est associé. Le type est nommé sans décrire de procédure de transformation.",
        "declared_variety": "Profil fictif floral et épicé",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Static Sift — classification descriptive",
        "texture": "Fine et sableuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "concentrate_type": {"value": "static-sift", "display": "Static Sift", "option": "static-sift"},
          "declared_variety": {"value": "Profil fictif floral et épicé", "display": "Profil fictif floral et épicé"},
          "texture": {"value": "sandy", "display": "Sableuse — appréciation illustrative", "option": "sandy"}
        }
      },
      {
        "seed_key": "demo.solventless.live-rosin",
        "short_description": "Live Rosin fictif à la teinte crème dorée et à la texture résineuse, sans donnée analytique réelle.",
        "full_description": "Cette entrée illustre la sous-catégorie Live Rosin avec une matière brillante, souple et crème dorée. Le type Rosin et la texture résineuse sont renseignés pour démontrer les champs communs aux concentrés sans solvant.\n\nLa variété, le producteur, la composition et l’origine sont fictifs ou non attribués. Aucun paramètre de transformation ni résultat de laboratoire n’est présenté.",
        "declared_variety": "Profil fictif fruité et herbacé",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Live Rosin — classification descriptive",
        "texture": "Résineuse et crémeuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "concentrate_type": {"value": "rosin", "display": "Rosin", "option": "rosin"},
          "declared_variety": {"value": "Profil fictif fruité et herbacé", "display": "Profil fictif fruité et herbacé"},
          "texture": {"value": "resinous", "display": "Résineuse — appréciation illustrative", "option": "resinous"}
        }
      }
    ]
    $demo$::jsonb) as demo_content(
      seed_key text,
      short_description text,
      full_description text,
      declared_variety text,
      declared_producer text,
      method text,
      texture text,
      country text,
      region text,
      fields jsonb
    )
  loop
    update public.entries as e
    set short_description = content.short_description,
        full_description = content.full_description,
        declared_variety = content.declared_variety,
        declared_producer = content.declared_producer,
        method = content.method,
        texture = content.texture,
        country = content.country,
        region = content.region,
        updated_at = now()
    where e.seed_key = content.seed_key
      and e.is_demo
      and (e.short_description,e.full_description,e.declared_variety,e.declared_producer,
        e.method,e.texture,e.country,e.region) is distinct from
        (content.short_description,content.full_description,content.declared_variety,
        content.declared_producer,content.method,content.texture,content.country,content.region);

    for field_item in
      select key as field_key,value as field_data
      from jsonb_each(content.fields)
    loop
      insert into public.entry_field_values as existing(
        id,entry_id,field_definition_id,option_id,value,display_value,created_at,updated_at)
      select extensions.gen_random_uuid(),e.id,d.id,o.id,field_item.field_data->'value',
        field_item.field_data->>'display',now(),now()
      from public.entries e
      join public.dynamic_field_definitions d on d.category_id=e.category_id
        and d.subcategory_id is null and d.key=field_item.field_key and d.deleted_at is null
      left join public.dynamic_field_options o on o.field_definition_id=d.id
        and o.value=field_item.field_data->>'option' and o.is_active
      where e.seed_key=content.seed_key and e.is_demo
        and (not (field_item.field_data ? 'option') or o.id is not null)
      on conflict(entry_id,field_definition_id) do update
      set option_id=excluded.option_id,
          value=excluded.value,
          display_value=excluded.display_value,
          updated_at=now()
      where (existing.option_id,existing.value,existing.display_value) is distinct from
        (excluded.option_id,excluded.value,excluded.display_value);
    end loop;
  end loop;
end $$;

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
    'bot_conversation_states','telegram_auth_replays','telegram_update_receipts','rate_limit_buckets',
    'contests','contest_participations','contest_winners'
  ] loop
    if to_regclass(format('public.%I',table_name)) is not null then
      execute format('alter table public.%I enable row level security',table_name);
    end if;
  end loop;
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

-- Concours communautaires, participations, classements et gagnants. This block
-- mirrors migrations/003_contests.sql for a fresh database bootstrap.
do $$ begin create type public.contest_status as enum
  ('DRAFT','SCHEDULED','ACTIVE','PAUSED','ENDED','CANCELLED','UPCOMING','OPEN','FULL','CLOSED','ENDED_PENDING_RESULT');
exception when duplicate_object then null; end $$;
do $$ begin create type public.contest_scoring_mode as enum
  ('MANUAL','ENTRY_LIKES','ENTRY_VIEWS','ENTRY_FAVORITES','ENTRY_RATING','COMPOSITE');
exception when duplicate_object then null; end $$;
do $$ begin create type public.contest_participation_status as enum
  ('PENDING_REVIEW','APPROVED','REJECTED','WITHDRAWN','DISQUALIFIED');
exception when duplicate_object then null; end $$;

create table if not exists public.contests (
  id uuid primary key default extensions.gen_random_uuid(), slug text not null unique,
  title text not null, summary text not null, description text not null, rules text not null,
  image_url text, status public.contest_status not null default 'DRAFT',
  is_featured boolean not null default false, starts_at timestamptz not null,
  ends_at timestamptz not null,
  scoring_mode public.contest_scoring_mode not null default 'MANUAL',
  criteria jsonb not null default '{}'::jsonb, reward jsonb not null default '{}'::jsonb,
  reward_badge_id uuid references public.badges(id) on delete set null,
  max_participants integer, require_entry boolean not null default true,
  created_by_id uuid not null references public.users(id) on delete restrict,
  updated_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contests_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint contests_title_length check (char_length(title) between 2 and 180),
  constraint contests_summary_length check (char_length(summary) between 2 and 320),
  constraint contests_description_length check (char_length(description) between 2 and 20000),
  constraint contests_rules_length check (char_length(rules) between 2 and 20000),
  constraint contests_image_url_http check (image_url is null or image_url ~ '^https?://'),
  constraint contests_dates_order check (ends_at > starts_at),
  constraint contests_json_objects check
    (jsonb_typeof(criteria)='object' and jsonb_typeof(reward)='object'),
  constraint contests_max_participants_positive check
    (max_participants is null or max_participants > 0)
);
create table if not exists public.contest_participations (
  id uuid primary key default extensions.gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete set null,
  status public.contest_participation_status not null default 'PENDING_REVIEW',
  statement text, manual_score numeric(14,4) not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  moderated_by_id uuid references public.users(id) on delete set null,
  moderated_at timestamptz, moderation_note text,
  submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint contest_participations_contest_user_unique unique(contest_id,user_id),
  constraint contest_participations_id_contest_unique unique(id,contest_id),
  constraint contest_participations_statement_length check
    (statement is null or char_length(statement)<=2000),
  constraint contest_participations_note_length check
    (moderation_note is null or char_length(moderation_note)<=2000),
  constraint contest_participations_score_object check(jsonb_typeof(score_breakdown)='object'),
  constraint contest_participations_withdrawal_consistency check
    ((status='WITHDRAWN' and withdrawn_at is not null)
      or (status<>'WITHDRAWN' and withdrawn_at is null))
);
create table if not exists public.contest_winners (
  id uuid primary key default extensions.gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  participation_id uuid not null, rank smallint not null, label text,
  prize jsonb not null default '{}'::jsonb,
  selected_by_id uuid references public.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  constraint contest_winners_participation_contest_fk
    foreign key(participation_id,contest_id)
    references public.contest_participations(id,contest_id) on delete cascade,
  constraint contest_winners_contest_rank_unique unique(contest_id,rank),
  constraint contest_winners_contest_participation_unique unique(contest_id,participation_id),
  constraint contest_winners_rank_positive check(rank>0),
  constraint contest_winners_label_length check(label is null or char_length(label)<=180),
  constraint contest_winners_prize_object check(jsonb_typeof(prize)='object')
);
create index if not exists contests_public_schedule_idx
  on public.contests(status,starts_at,ends_at,is_featured) where deleted_at is null;
create index if not exists contests_reward_badge_idx on public.contests(reward_badge_id)
  where reward_badge_id is not null;
create index if not exists contest_participations_contest_status_idx
  on public.contest_participations(contest_id,status,submitted_at desc);
create index if not exists contest_participations_entry_idx
  on public.contest_participations(entry_id) where entry_id is not null;
create index if not exists contest_participations_user_idx
  on public.contest_participations(user_id,submitted_at desc);
create index if not exists contest_winners_participation_idx
  on public.contest_winners(participation_id);
drop trigger if exists set_updated_at on public.contests;
create trigger set_updated_at before update on public.contests
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.contest_participations;
create trigger set_updated_at before update on public.contest_participations
  for each row execute function public.set_updated_at();
create or replace function public.award_contest_winner_badge()
returns trigger language plpgsql security definer set search_path='' as $$
declare badge_to_award uuid; winning_user uuid;
  participation_status public.contest_participation_status; begin
  select c.reward_badge_id,p.user_id,p.status
    into badge_to_award,winning_user,participation_status
  from public.contests c join public.contest_participations p
    on p.id=new.participation_id and p.contest_id=c.id
  where c.id=new.contest_id;
  if participation_status is distinct from 'APPROVED' then
    raise exception 'contest winner participation must be approved' using errcode='23514';
  end if;
  if badge_to_award is not null and exists(
    select 1 from public.badges b where b.id=badge_to_award and b.is_active
  ) then
    insert into public.user_badges(user_id,badge_id,awarded_by_id,metadata)
    select winning_user,badge_to_award,new.selected_by_id,
      jsonb_build_object('contestId',new.contest_id,'winnerId',new.id,'rank',new.rank)
    where not exists(select 1 from public.user_badges ub
      where ub.user_id=winning_user and ub.badge_id=badge_to_award
        and ub.is_active and ub.revoked_at is null) on conflict do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.award_contest_winner_badge() from public,anon,authenticated;
grant execute on function public.award_contest_winner_badge() to service_role;
drop trigger if exists award_contest_winner_badge on public.contest_winners;
create trigger award_contest_winner_badge after insert or update of participation_id,rank
  on public.contest_winners for each row execute function public.award_contest_winner_badge();
insert into public.permissions(code,name,description) values
  ('contest.manage','Gérer les concours','Créer, configurer et désigner les gagnants'),
  ('contest.moderate','Modérer les concours','Examiner et noter les participations')
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.role_permissions(role,permission_code) values
  ('OWNER','contest.manage'),('OWNER','contest.moderate'),
  ('ADMIN','contest.manage'),('ADMIN','contest.moderate'),
  ('MODERATOR','contest.moderate'),('MODERATOR','entry.moderate')
on conflict do nothing;
alter table public.contests enable row level security;
alter table public.contest_participations enable row level security;
alter table public.contest_winners enable row level security;
drop policy if exists public_contests_read on public.contests;
create policy public_contests_read on public.contests for select to anon,authenticated
  using(deleted_at is null and status in ('SCHEDULED','ACTIVE','PAUSED','ENDED'));
drop policy if exists public_contest_participations_read on public.contest_participations;
create policy public_contest_participations_read on public.contest_participations
  for select to anon,authenticated using(
    status='APPROVED'
    and exists(select 1 from public.contests c where c.id=contest_participations.contest_id and c.deleted_at is null
      and c.status in ('SCHEDULED','ACTIVE','PAUSED','ENDED'))
    and exists(select 1 from public.users u where u.id=contest_participations.user_id
      and u.account_kind='TELEGRAM' and not u.is_system
      and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED')
    and (entry_id is null or exists(select 1 from public.entries e where e.id=contest_participations.entry_id
      and e.status='PUBLISHED' and e.deleted_at is null))
  );
drop policy if exists public_contest_winners_read on public.contest_winners;
create policy public_contest_winners_read on public.contest_winners
  for select to anon,authenticated using(
    exists(select 1 from public.contest_participations p join public.users u on u.id=p.user_id
      where p.id=contest_winners.participation_id
        and p.contest_id=contest_winners.contest_id and p.status='APPROVED'
        and u.account_kind='TELEGRAM' and not u.is_system
        and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED')
    and exists(select 1 from public.contests c where c.id=contest_winners.contest_id and c.deleted_at is null
      and c.status in ('SCHEDULED','ACTIVE','PAUSED','ENDED'))
  );
revoke all privileges on public.contests,public.contest_participations,public.contest_winners
  from anon,authenticated;
grant select(id,slug,title,summary,description,rules,image_url,status,is_featured,starts_at,
  ends_at,scoring_mode,criteria,reward,reward_badge_id,max_participants,require_entry,
  created_at,updated_at) on public.contests to anon,authenticated;
grant select(id,contest_id,user_id,entry_id,status,manual_score,score_breakdown,submitted_at,
  updated_at) on public.contest_participations to anon,authenticated;
grant select(id,contest_id,participation_id,rank,label,prize,awarded_at)
  on public.contest_winners to anon,authenticated;
grant select(account_kind,is_system) on public.users to anon,authenticated;
grant all privileges on public.contests,public.contest_participations,public.contest_winners
  to service_role;

-- Evolution 006: avis, notifications, concours configurables, analytics et suivi equipe.
do $$ begin create type public.review_moderation_action as enum
  ('SUBMITTED','CHANGES_REQUESTED','RESUBMITTED','APPROVED','REJECTED','HIDDEN','RESTORED','DELETED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.user_notification_type as enum
  ('REVIEW_APPROVED','REVIEW_REJECTED','REVIEW_CHANGES_REQUESTED','REVIEW_RESUBMITTED',
   'ENTRY_APPROVED','ENTRY_REJECTED','CONTEST','SYSTEM','ENTRY_CHANGES_REQUESTED','CONTEST_NEW','CONTEST_RESULT','CONTEST_WINNER');
exception when duplicate_object then null; end $$;
do $$ begin create type public.contest_type as enum
  ('GAME','DRAW','CREATIVE','ENTRY','EXTERNAL_LINK','COMMUNITY','OTHER','WEIGHT_GUESS');
exception when duplicate_object then null; end $$;
do $$ begin create type public.user_session_platform as enum
  ('MINI_APP','WEB','TELEGRAM_BOT','ADMIN_WEB','UNKNOWN');
exception when duplicate_object then null; end $$;
do $$ begin create type public.user_activity_event_type as enum
  ('APP_OPEN','ENTRY_VIEW','SEARCH','LIKE','UNLIKE','FAVORITE','REVIEW_SUBMIT','ENTRY_SUBMIT',
   'PARTNER_VIEW','MESSAGE_SENT','CONTEST_JOIN');
exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_outbound_message_status as enum
  ('QUEUED','SENT','FAILED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.user_moderation_action as enum
  ('WARNING','BAN','UNBAN');
exception when duplicate_object then null; end $$;
do $$ begin create type public.micron_context_type as enum
  ('COLLECTION_SEPARATION','PRESSING_BAG');
exception when duplicate_object then null; end $$;
do $$ begin create type public.micron_requirement as enum
  ('ABSENT','OPTIONAL','REQUIRED');
exception when duplicate_object then null; end $$;

-- Avis: informations de moderation courantes et snapshots complets des versions.
alter table public.reviews
  add column if not exists moderated_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists changes_requested_at timestamptz;
update public.reviews
set moderated_at=coalesce(moderated_at,approved_at,updated_at)
where moderated_at is null and status in ('APPROVED','PUBLISHED','REJECTED','CHANGES_REQUESTED');
update public.reviews
set rejected_at=coalesce(rejected_at,moderated_at,updated_at)
where rejected_at is null and status='REJECTED';
update public.reviews
set changes_requested_at=coalesce(changes_requested_at,moderated_at,updated_at)
where changes_requested_at is null and status='CHANGES_REQUESTED';

alter table public.review_versions
  add column if not exists ratings_snapshot jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.review_versions add constraint review_versions_ratings_snapshot_array
    check(jsonb_typeof(ratings_snapshot)='array');
exception when duplicate_object then null; end $$;

create table if not exists public.review_moderation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  action public.review_moderation_action not null,
  previous_status public.review_status,
  new_status public.review_status,
  message text,
  admin_id uuid references public.users(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  review_version_id uuid references public.review_versions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint review_moderation_events_message_required check(
    action not in ('CHANGES_REQUESTED','REJECTED')
    or (message is not null and char_length(btrim(message)) between 1 and 5000)
  ),
  constraint review_moderation_events_metadata_object check(jsonb_typeof(metadata)='object'),
  constraint review_moderation_events_resolution_consistency check(
    (resolved_at is null and resolved_by_user_id is null)
    or (resolved_at is not null)
  )
);
create index if not exists review_moderation_events_review_created_idx
  on public.review_moderation_events(review_id,created_at desc);
create index if not exists review_moderation_events_admin_created_idx
  on public.review_moderation_events(admin_id,created_at desc) where admin_id is not null;
create index if not exists review_moderation_events_user_created_idx
  on public.review_moderation_events(user_id,created_at desc) where user_id is not null;
create index if not exists review_moderation_events_action_created_idx
  on public.review_moderation_events(action,created_at desc);
create unique index if not exists review_moderation_events_one_open_change_idx
  on public.review_moderation_events(review_id)
  where action='CHANGES_REQUESTED' and resolved_at is null;

create table if not exists public.user_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type public.user_notification_type not null,
  title text not null check(char_length(btrim(title)) between 1 and 180),
  message text not null check(char_length(btrim(message)) between 1 and 5000),
  related_review_id uuid references public.reviews(id) on delete set null,
  related_entry_id uuid references public.entries(id) on delete set null,
  related_contest_id uuid references public.contests(id) on delete set null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  telegram_sent_at timestamptz,
  telegram_error text,
  created_at timestamptz not null default now(),
  constraint user_notifications_metadata_object check(jsonb_typeof(metadata)='object'),
  constraint user_notifications_read_consistency check(
    (is_read and read_at is not null) or (not is_read and read_at is null)
  ),
  constraint user_notifications_action_url_local check(
    action_url is null or action_url ~ '^/[A-Za-z0-9/_?&=.#%-]*$'
  )
);
create index if not exists user_notifications_user_created_idx
  on public.user_notifications(user_id,created_at desc);
create index if not exists user_notifications_user_unread_idx
  on public.user_notifications(user_id,created_at desc) where not is_read;
create index if not exists user_notifications_review_idx
  on public.user_notifications(related_review_id) where related_review_id is not null;

-- Concours: instructions administrables, periode d'inscription et quota atomique.
alter table public.contests
  add column if not exists contest_type public.contest_type not null default 'OTHER',
  add column if not exists instructions text not null default '',
  add column if not exists participation_steps jsonb not null default '[]'::jsonb,
  add column if not exists external_url text,
  add column if not exists telegram_url text,
  add column if not exists instagram_url text,
  add column if not exists terms text,
  add column if not exists additional_information text,
  add column if not exists registrations_open boolean not null default true,
  add column if not exists registration_starts_at timestamptz,
  add column if not exists registration_ends_at timestamptz,
  add column if not exists registrations_closed_at timestamptz;
do $$ begin
  alter table public.contests add constraint contests_participation_steps_array
    check(jsonb_typeof(participation_steps)='array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_registration_dates_order
    check(registration_starts_at is null or registration_ends_at is null
      or registration_ends_at>registration_starts_at);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_links_http
    check((external_url is null or external_url ~ '^https?://')
      and (telegram_url is null or telegram_url ~ '^https?://')
      and (instagram_url is null or instagram_url ~ '^https?://'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_registration_closed_consistency
    check(registrations_open or registrations_closed_at is not null);
exception when duplicate_object then null; end $$;

create or replace function public.enforce_contest_participation_quota()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  contest_row public.contests%rowtype;
  occupied_places bigint;
  opens_at timestamptz;
  closes_at timestamptz;
begin
  -- Une moderation PENDING_REVIEW -> APPROVED occupe deja une place: elle reste
  -- autorisee meme apres la fermeture. Seules les reactivations et les
  -- deplacements vers un autre concours doivent reprendre le quota.
  if tg_op='UPDATE' then
    if new.status in ('REJECTED','WITHDRAWN','DISQUALIFIED') then return new; end if;
    if new.contest_id=old.contest_id
      and old.status not in ('REJECTED','WITHDRAWN','DISQUALIFIED') then return new; end if;
    if new.contest_id<>old.contest_id then
      perform 1 from public.contests c
      where c.id in (old.contest_id,new.contest_id)
      order by c.id for update;
    end if;
  end if;
  select * into contest_row from public.contests
    where id=new.contest_id and deleted_at is null for update;
  if not found then raise exception 'contest_not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.users u where u.id=new.user_id) then
    raise exception 'user_not_found' using errcode='P0002';
  end if;
  if exists(select 1 from public.users u where u.id=new.user_id
      and (u.is_banned or u.role='BANNED'
        or (u.banned_until is not null and u.banned_until>now()))) then
    raise exception 'user_banned' using errcode='42501';
  end if;
  opens_at:=coalesce(contest_row.registration_starts_at,contest_row.starts_at);
  closes_at:=coalesce(contest_row.registration_ends_at,contest_row.ends_at);
  if not contest_row.registrations_open or contest_row.status::text not in ('ACTIVE','OPEN')
    or now()<opens_at or now()>=closes_at then
    raise exception 'contest_registrations_closed' using errcode='23514';
  end if;
  if contest_row.require_entry and new.entry_id is null then
    raise exception 'contest_entry_required' using errcode='23514';
  end if;
  if new.entry_id is not null
    and not exists(select 1 from public.entries e where e.id=new.entry_id) then
    raise exception 'contest_entry_not_found' using errcode='23503';
  end if;
  if contest_row.max_participants is not null then
    select count(*) into occupied_places from public.contest_participations p
      where p.contest_id=new.contest_id
        and p.status not in ('REJECTED','WITHDRAWN','DISQUALIFIED');
    if occupied_places>=contest_row.max_participants then
      raise exception 'contest_full' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_contest_participation_quota()
  from public,anon,authenticated;
grant execute on function public.enforce_contest_participation_quota() to service_role;
drop trigger if exists enforce_contest_participation_quota on public.contest_participations;
create trigger enforce_contest_participation_quota before insert or update of status,contest_id
  on public.contest_participations for each row
  execute function public.enforce_contest_participation_quota();

create or replace function public.join_contest(
  p_contest_id uuid,
  p_user_id uuid,
  p_entry_id uuid default null,
  p_statement text default null
) returns public.contest_participations
language plpgsql security definer set search_path='' as $$
declare joined public.contest_participations;
begin
  insert into public.contest_participations(contest_id,user_id,entry_id,statement)
  values(p_contest_id,p_user_id,p_entry_id,nullif(btrim(p_statement),''))
  returning * into joined;
  return joined;
exception when unique_violation then
  raise exception 'contest_already_joined' using errcode='23505';
end $$;
revoke execute on function public.join_contest(uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.join_contest(uuid,uuid,uuid,text) to service_role;

create or replace function public.contest_participant_count(p_contest_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
  select count(*)::bigint from public.contest_participations p
  where p.contest_id=p_contest_id
    and p.status not in ('REJECTED','WITHDRAWN','DISQUALIFIED')
$$;
revoke execute on function public.contest_participant_count(uuid)
  from public,anon,authenticated;
grant execute on function public.contest_participant_count(uuid) to service_role;

create or replace function public.sync_contest_full_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid; contest_row public.contests%rowtype; occupied bigint;
begin
  for target_id in
    select candidate.contest_id
    from unnest(array[
      case when tg_op<>'DELETE' then new.contest_id end,
      case when tg_op<>'INSERT' then old.contest_id end
    ]::uuid[]) as candidate(contest_id)
    where candidate.contest_id is not null
    group by candidate.contest_id
    order by candidate.contest_id
  loop
    select * into contest_row from public.contests where id=target_id for update;
    if found and contest_row.max_participants is not null then
      select count(*) into occupied from public.contest_participations p
        where p.contest_id=target_id
          and p.status not in ('REJECTED','WITHDRAWN','DISQUALIFIED');
      if occupied>=contest_row.max_participants
          and contest_row.status::text in ('ACTIVE','OPEN') then
        execute 'update public.contests set status=$1::public.contest_status,updated_at=now() where id=$2'
          using 'FULL',target_id;
      elsif occupied<contest_row.max_participants and contest_row.status::text='FULL'
          and contest_row.registrations_open
          and now()>=coalesce(contest_row.registration_starts_at,contest_row.starts_at)
          and now()<coalesce(contest_row.registration_ends_at,contest_row.ends_at) then
        execute 'update public.contests set status=$1::public.contest_status,updated_at=now() where id=$2'
          using 'OPEN',target_id;
      end if;
    end if;
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.sync_contest_full_status()
  from public,anon,authenticated;
grant execute on function public.sync_contest_full_status() to service_role;
drop trigger if exists sync_contest_full_status on public.contest_participations;
create trigger sync_contest_full_status after insert or delete or update of status,contest_id
  on public.contest_participations for each row execute function public.sync_contest_full_status();

-- Analytics strictement limites aux interactions Poketerps.
create table if not exists public.user_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_activity_at timestamptz not null default now(),
  duration_seconds integer,
  platform public.user_session_platform not null default 'UNKNOWN',
  app_version text,
  client_session_id text unique,
  created_at timestamptz not null default now(),
  constraint user_sessions_time_order check(
    ended_at is null or (ended_at>=started_at and last_activity_at>=started_at)
  ),
  constraint user_sessions_duration_nonnegative check(
    duration_seconds is null or duration_seconds>=0
  )
);
create index if not exists user_sessions_user_started_idx
  on public.user_sessions(user_id,started_at desc);
create index if not exists user_sessions_active_idx
  on public.user_sessions(last_activity_at desc) where ended_at is null;

create table if not exists public.user_activity_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid references public.user_sessions(id) on delete set null,
  event_type public.user_activity_event_type not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_activity_events_entity_consistency check(
    (entity_type is null and entity_id is null) or entity_type is not null
  ),
  constraint user_activity_events_metadata_object check(jsonb_typeof(metadata)='object')
);
create index if not exists user_activity_events_user_created_idx
  on public.user_activity_events(user_id,created_at desc);
create index if not exists user_activity_events_type_created_idx
  on public.user_activity_events(event_type,created_at desc);
create index if not exists user_activity_events_session_idx
  on public.user_activity_events(session_id,created_at) where session_id is not null;

-- Administration des utilisateurs, messages, bans, notes et permissions nominatives.
alter table public.users
  add column if not exists banned_until timestamptz,
  add column if not exists banned_by_id uuid references public.users(id) on delete set null,
  add column if not exists role_before_ban public.user_role;
do $$ begin
  alter table public.users add constraint users_ban_expiry_consistency check(
    not is_banned or banned_until is null or banned_until>suspended_at
  );
exception when duplicate_object then null; end $$;
create index if not exists users_banned_until_idx on public.users(banned_until)
  where is_banned and banned_until is not null;

create table if not exists public.admin_outbound_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  admin_id uuid not null references public.users(id) on delete restrict,
  content text not null check(char_length(btrim(content)) between 1 and 4096),
  status public.admin_outbound_message_status not null default 'QUEUED',
  telegram_message_id bigint,
  error_message text,
  idempotency_key text unique,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_outbound_messages_delivery_consistency check(
    (status='SENT' and sent_at is not null and error_message is null)
    or (status='FAILED' and error_message is not null)
    or status='QUEUED'
  )
);
create index if not exists admin_outbound_messages_user_created_idx
  on public.admin_outbound_messages(user_id,created_at desc);
create index if not exists admin_outbound_messages_admin_created_idx
  on public.admin_outbound_messages(admin_id,created_at desc);
create index if not exists admin_outbound_messages_status_created_idx
  on public.admin_outbound_messages(status,created_at);

create table if not exists public.user_moderation_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  admin_id uuid references public.users(id) on delete set null,
  action public.user_moderation_action not null,
  reason text not null check(char_length(btrim(reason)) between 1 and 2000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  previous_role public.user_role,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_moderation_events_dates_order check(ends_at is null or ends_at>starts_at),
  constraint user_moderation_events_metadata_object check(jsonb_typeof(metadata)='object')
);
create index if not exists user_moderation_events_user_created_idx
  on public.user_moderation_events(user_id,created_at desc);
create index if not exists user_moderation_events_admin_created_idx
  on public.user_moderation_events(admin_id,created_at desc);
create index if not exists user_moderation_events_action_created_idx
  on public.user_moderation_events(action,created_at desc);

create table if not exists public.admin_user_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  admin_id uuid not null references public.users(id) on delete restrict,
  content text not null check(char_length(btrim(content)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_user_notes_user_created_idx
  on public.admin_user_notes(user_id,created_at desc);
create index if not exists admin_user_notes_admin_created_idx
  on public.admin_user_notes(admin_id,created_at desc);
drop trigger if exists set_updated_at on public.admin_user_notes;
create trigger set_updated_at before update on public.admin_user_notes
  for each row execute function public.set_updated_at();

create table if not exists public.role_history (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  previous_role public.user_role,
  new_role public.user_role not null,
  changed_by_id uuid references public.users(id) on delete set null,
  reason text,
  source text not null default 'SYSTEM'
    check(source in ('WEB_ADMIN','TELEGRAM_ADMIN','MINI_APP','API','SYSTEM')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint role_history_actual_change check(previous_role is null or previous_role<>new_role),
  constraint role_history_metadata_object check(jsonb_typeof(metadata)='object')
);
create index if not exists role_history_user_created_idx
  on public.role_history(user_id,created_at desc);
create index if not exists role_history_new_role_created_idx
  on public.role_history(new_role,created_at desc);
create index if not exists role_history_changed_by_idx
  on public.role_history(changed_by_id,created_at desc) where changed_by_id is not null;

create or replace function public.capture_user_role_history()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor_text text; source_text text; actor_id uuid;
begin
  actor_text:=nullif(current_setting('app.actor_user_id',true),'');
  if actor_text is not null then
    begin actor_id:=actor_text::uuid; exception when invalid_text_representation then actor_id:=null; end;
  end if;
  source_text:=coalesce(nullif(current_setting('app.audit_source',true),''),'SYSTEM');
  if source_text not in ('WEB_ADMIN','TELEGRAM_ADMIN','MINI_APP','API','SYSTEM') then
    source_text:='SYSTEM';
  end if;
  insert into public.role_history(user_id,previous_role,new_role,changed_by_id,source,metadata)
  values(new.id,old.role,new.role,actor_id,source_text,
    jsonb_build_object('automatic',true));
  return new;
end $$;
revoke execute on function public.capture_user_role_history()
  from public,anon,authenticated;
grant execute on function public.capture_user_role_history() to service_role;
drop trigger if exists capture_user_role_history on public.users;
create trigger capture_user_role_history after update of role on public.users
  for each row when(old.role is distinct from new.role)
  execute function public.capture_user_role_history();

insert into public.role_history(user_id,new_role,source,metadata,created_at)
select u.id,u.role,'SYSTEM',
  jsonb_build_object('baseline',true,'meaning','first-known-role-at-migration'),now()
from public.users u
where u.role in ('OWNER','ADMIN','MODERATOR')
  and not exists(select 1 from public.role_history h where h.user_id=u.id and h.new_role=u.role);

create table if not exists public.user_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  is_granted boolean not null default true,
  granted_by_id uuid references public.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,permission_code)
);
create index if not exists user_permissions_permission_idx
  on public.user_permissions(permission_code,user_id) where is_granted;
create index if not exists user_permissions_expires_idx
  on public.user_permissions(expires_at) where expires_at is not null;
drop trigger if exists set_updated_at on public.user_permissions;
create trigger set_updated_at before update on public.user_permissions
  for each row execute function public.set_updated_at();

alter table public.permissions drop constraint if exists permissions_code_check;
alter table public.permissions add constraint permissions_code_check check(
  code ~ '^[a-z][a-z0-9_.-]+$' or code ~ '^[A-Z][A-Z0-9_]+$'
);

insert into public.permissions(code,name,description) values
  ('VIEW_ADMIN_ACTIVITY','Voir l''activite des administrateurs',
    'Consulter les statistiques des OWNER et ADMIN autorises'),
  ('VIEW_MODERATOR_ACTIVITY','Voir l''activite des moderateurs',
    'Consulter les statistiques des moderateurs'),
  ('VIEW_TEAM_AUDIT_LOG','Voir le journal detaille de l''equipe',
    'Consulter les actions detaillees produites dans Poketerps')
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.role_permissions(role,permission_code) values
  ('OWNER','VIEW_ADMIN_ACTIVITY'),('OWNER','VIEW_MODERATOR_ACTIVITY'),
  ('OWNER','VIEW_TEAM_AUDIT_LOG'),('ADMIN','VIEW_MODERATOR_ACTIVITY')
on conflict do nothing;

create or replace function public.user_has_permission(p_user_id uuid,p_permission_code text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(
    (select up.is_granted from public.user_permissions up
      where up.user_id=p_user_id and up.permission_code=p_permission_code
        and (up.expires_at is null or up.expires_at>now())),
    exists(select 1 from public.users u join public.role_permissions rp on rp.role=u.role
      where u.id=p_user_id and not u.is_banned and u.role<>'BANNED'
        and rp.permission_code=p_permission_code),
    false
  )
$$;
revoke execute on function public.user_has_permission(uuid,text)
  from public,anon,authenticated;
grant execute on function public.user_has_permission(uuid,text) to service_role;

create or replace function public.expire_user_ban(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare banned_user public.users%rowtype; restored_role public.user_role;
begin
  select * into banned_user from public.users where id=p_user_id for update;
  if not found or not banned_user.is_banned or banned_user.banned_until is null
    or banned_user.banned_until>now() then
    return false;
  end if;
  restored_role:=coalesce(banned_user.role_before_ban,
    case when banned_user.role='BANNED' then 'MEMBER'::public.user_role
      else banned_user.role end);
  update public.users set role=restored_role,is_banned=false,suspended_at=null,
    suspension_reason=null,banned_until=null,banned_by_id=null,role_before_ban=null,
    updated_at=now() where id=p_user_id;
  insert into public.user_moderation_events(
    user_id,admin_id,action,reason,starts_at,previous_role,metadata
  ) values(
    p_user_id,null,'UNBAN','Expiration automatique du bannissement',now(),
    banned_user.role,jsonb_build_object('automatic',true,'expiredAt',banned_user.banned_until)
  );
  insert into public.audit_logs(
    actor_user_id,actor_role,action,entity_type,entity_id,source,before_data,after_data,metadata
  ) values(
    null,null,'USER_BAN_EXPIRED','USER',p_user_id,'SYSTEM',
    jsonb_build_object('role',banned_user.role,'bannedUntil',banned_user.banned_until),
    jsonb_build_object('role',restored_role,'isBanned',false),
    jsonb_build_object('automatic',true)
  );
  return true;
end $$;
revoke execute on function public.expire_user_ban(uuid) from public,anon,authenticated;
grant execute on function public.expire_user_ban(uuid) to service_role;

-- AuditLog reste la source principale du suivi equipe.
alter table public.audit_logs add column if not exists actor_role public.user_role;
alter table public.audit_logs drop constraint if exists audit_logs_source_check;
alter table public.audit_logs add constraint audit_logs_source_check check(
  source in ('WEB','TELEGRAM','SYSTEM','WEB_ADMIN','TELEGRAM_ADMIN','MINI_APP','API')
);
create index if not exists audit_logs_actor_role_created_idx
  on public.audit_logs(actor_role,created_at desc) where actor_role is not null;
create index if not exists audit_logs_action_created_idx
  on public.audit_logs(action,created_at desc);
create index if not exists audit_logs_source_created_idx
  on public.audit_logs(source,created_at desc);

create or replace function public.fill_audit_actor_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.actor_role is null and new.actor_user_id is not null then
    select u.role into new.actor_role from public.users u where u.id=new.actor_user_id;
  end if;
  return new;
end $$;
revoke execute on function public.fill_audit_actor_role()
  from public,anon,authenticated;
grant execute on function public.fill_audit_actor_role() to service_role;
drop trigger if exists fill_audit_actor_role on public.audit_logs;
create trigger fill_audit_actor_role before insert on public.audit_logs
  for each row execute function public.fill_audit_actor_role();
update public.audit_logs a set actor_role=u.role
from public.users u where a.actor_user_id=u.id and a.actor_role is null;

-- Taxonomie explicable et deux contextes micron distincts.
alter table public.categories
  add column if not exists technical_name text,
  add column if not exists display_name text,
  add column if not exists french_explanation text;
alter table public.subcategories
  add column if not exists technical_name text,
  add column if not exists display_name text,
  add column if not exists french_explanation text,
  add column if not exists micron_requirement public.micron_requirement not null default 'ABSENT',
  add column if not exists allowed_micron_contexts public.micron_context_type[] not null
    default '{}'::public.micron_context_type[];
alter table public.dynamic_field_options
  add column if not exists technical_name text,
  add column if not exists display_name text,
  add column if not exists french_explanation text;
alter table public.micron_presets
  add column if not exists context public.micron_context_type,
  add column if not exists technical_name text,
  add column if not exists display_name text,
  add column if not exists french_explanation text;
update public.categories set display_name=coalesce(display_name,name);
update public.subcategories set display_name=coalesce(display_name,name);
update public.dynamic_field_options set display_name=coalesce(display_name,label);
update public.micron_presets set display_name=coalesce(display_name,label);

create table if not exists public.entry_micron_contexts (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  context public.micron_context_type not null,
  mode public.micron_mode not null default 'NONE',
  single_value smallint check(single_value between 1 and 1000),
  minimum_value smallint check(minimum_value between 1 and 1000),
  maximum_value smallint check(maximum_value between 1 and 1000),
  multiple_values smallint[],
  is_full_spectrum boolean not null default false,
  is_mixed_micron boolean not null default false,
  display_label text,
  source_type public.micron_source_type not null default 'DECLARED',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entry_id,context),
  constraint entry_micron_contexts_range_order check(
    minimum_value is null or maximum_value is null or minimum_value<=maximum_value),
  constraint entry_micron_contexts_multiple_values check(
    multiple_values is null or (cardinality(multiple_values) between 1 and 20
      and 0<all(multiple_values) and 1000>=all(multiple_values))),
  constraint entry_micron_contexts_mode_values check(
    (mode='NONE' and single_value is null and minimum_value is null and maximum_value is null
      and multiple_values is null and not is_full_spectrum and not is_mixed_micron)
    or (mode='SINGLE' and single_value is not null)
    or (mode='RANGE' and minimum_value is not null and maximum_value is not null)
    or (mode='MULTIPLE' and multiple_values is not null)
    or (mode='FULL_SPECTRUM' and is_full_spectrum)
    or (mode='MIXED' and is_mixed_micron)
  )
);
create index if not exists entry_micron_contexts_context_idx
  on public.entry_micron_contexts(context,entry_id);
drop trigger if exists set_updated_at on public.entry_micron_contexts;
create trigger set_updated_at before update on public.entry_micron_contexts
  for each row execute function public.set_updated_at();
insert into public.entry_micron_contexts(
  entry_id,context,mode,single_value,minimum_value,maximum_value,multiple_values,
  is_full_spectrum,is_mixed_micron,display_label,source_type,notes,created_at,updated_at
)
select m.entry_id,'COLLECTION_SEPARATION',m.mode,m.single_value,m.minimum_value,m.maximum_value,
  m.multiple_values,m.is_full_spectrum,m.is_mixed_micron,m.display_label,m.source_type,m.notes,
  m.created_at,m.updated_at
from public.micron_specifications m
on conflict(entry_id,context) do nothing;

update public.micron_presets set context='COLLECTION_SEPARATION' where context is null;
insert into public.micron_presets(
  slug,mode,label,context,single_value,minimum_value,maximum_value,
  is_full_spectrum,is_mixed_micron,sort_order,is_active,display_name,french_explanation
) values
  ('75-um','SINGLE','75 µm','COLLECTION_SEPARATION',75,null,null,false,false,55,true,
    '75 µm','Taille de maille de collecte declaree'),
  ('250-um','SINGLE','250 µm','COLLECTION_SEPARATION',250,null,null,false,false,115,true,
    '250 µm','Taille de maille de collecte declaree'),
  ('73-120-um','RANGE','73–120 µm','COLLECTION_SEPARATION',null,73,120,false,false,145,true,
    '73–120 µm','Plage de collecte declaree'),
  ('collection-custom','NONE','Autre / valeur personnalisee','COLLECTION_SEPARATION',
    null,null,null,false,false,195,true,'Autre','Valeur de collecte personnalisee'),
  ('pressing-bag-5-um','SINGLE','5 µm','PRESSING_BAG',5,null,null,false,false,10,true,
    '5 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-15-um','SINGLE','15 µm','PRESSING_BAG',15,null,null,false,false,20,true,
    '15 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-25-um','SINGLE','25 µm','PRESSING_BAG',25,null,null,false,false,30,true,
    '25 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-37-um','SINGLE','37 µm','PRESSING_BAG',37,null,null,false,false,40,true,
    '37 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-45-um','SINGLE','45 µm','PRESSING_BAG',45,null,null,false,false,50,true,
    '45 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-73-um','SINGLE','73 µm','PRESSING_BAG',73,null,null,false,false,60,true,
    '73 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-75-um','SINGLE','75 µm','PRESSING_BAG',75,null,null,false,false,70,true,
    '75 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-90-um','SINGLE','90 µm','PRESSING_BAG',90,null,null,false,false,80,true,
    '90 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-120-um','SINGLE','120 µm','PRESSING_BAG',120,null,null,false,false,90,true,
    '120 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-160-um','SINGLE','160 µm','PRESSING_BAG',160,null,null,false,false,100,true,
    '160 µm','Taille declaree du sac de pressage'),
  ('pressing-bag-custom','NONE','Autre','PRESSING_BAG',null,null,null,false,false,110,true,
    'Autre','Taille personnalisee du sac de pressage'),
  ('pressing-bag-not-specified','NONE','Non precise','PRESSING_BAG',null,null,null,false,false,120,true,
    'Non precise','Taille du sac de pressage non declaree')
on conflict(slug) do update set
  mode=excluded.mode,label=excluded.label,context=excluded.context,
  single_value=excluded.single_value,minimum_value=excluded.minimum_value,
  maximum_value=excluded.maximum_value,is_full_spectrum=excluded.is_full_spectrum,
  is_mixed_micron=excluded.is_mixed_micron,sort_order=excluded.sort_order,
  is_active=true,display_name=excluded.display_name,
  french_explanation=excluded.french_explanation;

insert into public.subcategories(category_id,slug,name,description,sort_order)
select c.id,v.slug,v.name,v.description,v.sort_order
from public.categories c
join (values
  ('hash','frozen-dry-sift','Frozen Dry Sift','Dry sift issu de matière congelée',11),
  ('hash','dry-sift-presse','Dry Sift pressé','Dry sift présenté sous forme pressée',12),
  ('hash','dry-sift-non-presse','Dry Sift non pressé','Dry sift présenté sans pressage',13),
  ('hash','full-spectrum-dry-sift','Full Spectrum Dry Sift','Dry sift déclaré à spectre complet',14),
  ('hash','single-fraction','Single Fraction','Fraction unique de dry sift déclarée',15),
  ('hash','mixed-fraction','Mixed Fraction','Assemblage de fractions de dry sift déclarées',16),
  ('hash','static-tech','Static Tech','Dry sift purifié par séparation statique',21),
  ('hash','pressed-hash','Hash pressé','Hash traditionnel présenté sous forme pressée',115),
  ('hash','pollen-kief-presse','Pollen / Kief pressé','Pollen ou kief présenté sous forme pressée',116),
  ('rosin','dry-sift-rosin','Dry Sift Rosin','Rosin presse a partir de dry sift',35),
  ('rosin','bubble-hash-rosin','Bubble Hash Rosin','Rosin presse a partir de bubble hash',36)
) as v(category_slug,slug,name,description,sort_order) on v.category_slug=c.slug
on conflict(category_id,slug) do update set
  name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,
  is_visible=true,deleted_at=null;

update public.subcategories s set
  technical_name=case s.slug
    when 'dry-sift-rosin' then 'Dry Sift Rosin'
    when 'bubble-hash-rosin' then 'Bubble Hash Rosin'
    else s.technical_name end,
  display_name=coalesce(s.display_name,s.name),
  french_explanation=case s.slug
    when 'dry-sift-rosin' then 'Rosin presse a partir de dry sift'
    when 'bubble-hash-rosin' then 'Rosin presse a partir de bubble hash'
    else s.french_explanation end,
  micron_requirement='OPTIONAL',
  allowed_micron_contexts=
    array['COLLECTION_SEPARATION','PRESSING_BAG']::public.micron_context_type[]
from public.categories c
where c.id=s.category_id and c.slug='rosin'
  and s.slug in ('dry-sift-rosin','bubble-hash-rosin');

create table if not exists public.subcategory_micron_presets (
  subcategory_id uuid not null references public.subcategories(id) on delete cascade,
  micron_preset_id uuid not null references public.micron_presets(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(subcategory_id,micron_preset_id)
);
create index if not exists subcategory_micron_presets_preset_idx
  on public.subcategory_micron_presets(micron_preset_id,subcategory_id);

with targets(group_key,category_slug,subcategory_slug) as (values
  ('bubble','hash','bubble-hash'),('bubble','hash','ice-water-hash'),
  ('bubble','concentres-sans-solvant','bubble-hash'),
  ('bubble','concentres-sans-solvant','ice-water-hash'),
  ('dry','hash','dry-sift'),('dry','concentres-sans-solvant','dry-sift'),
  ('dry','hash','frozen-dry-sift'),('dry','hash','dry-sift-presse'),
  ('dry','hash','dry-sift-non-presse'),('dry','hash','full-spectrum-dry-sift'),
  ('dry','hash','single-fraction'),('dry','hash','mixed-fraction'),
  ('static','hash','static-sift'),('static','concentres-sans-solvant','static-sift'),
  ('static','hash','static-tech'),
  ('hash_rosin','rosin','hash-rosin'),('hash_rosin','rosin','live-rosin'),
  ('hash_rosin','rosin','bubble-hash-rosin'),
  ('hash_rosin','concentres-sans-solvant','hash-rosin'),
  ('hash_rosin','concentres-sans-solvant','live-rosin'),
  ('dry_rosin','rosin','dry-sift-rosin'),
  ('flower_rosin','rosin','flower-rosin'),
  ('flower_rosin','concentres-sans-solvant','flower-rosin')
), allowed(group_key,preset_slug,sort_order) as (values
  ('bubble','220-um',10),('bubble','190-um',20),('bubble','160-um',30),
  ('bubble','120-um',40),('bubble','90-um',50),('bubble','73-um',60),
  ('bubble','45-um',70),('bubble','25-um',80),('bubble','45-159-um',90),
  ('bubble','73-159-um',100),('bubble','90-120-um',110),('bubble','73-120-um',120),
  ('bubble','full-spectrum',130),('bubble','mixed-micron',140),
  ('bubble','collection-custom',150),('bubble','not-specified',160),
  ('dry','250-um',10),('dry','220-um',20),('dry','190-um',30),
  ('dry','160-um',40),('dry','150-um',50),('dry','120-um',60),
  ('dry','90-um',70),('dry','75-um',80),('dry','73-um',90),
  ('dry','45-um',100),('dry','25-um',110),('dry','collection-custom',120),
  ('dry','not-specified',130),
  ('static','45-um',10),('static','73-um',20),('static','90-um',30),
  ('static','120-um',40),('static','collection-custom',50),('static','not-specified',60),
  ('hash_rosin','73-159-um',10),('hash_rosin','73-120-um',20),
  ('hash_rosin','full-spectrum',30),('hash_rosin','mixed-micron',40),
  ('hash_rosin','not-specified',50),('hash_rosin','pressing-bag-5-um',110),
  ('hash_rosin','pressing-bag-15-um',120),('hash_rosin','pressing-bag-25-um',130),
  ('hash_rosin','pressing-bag-37-um',140),('hash_rosin','pressing-bag-45-um',150),
  ('hash_rosin','pressing-bag-custom',160),('hash_rosin','pressing-bag-not-specified',170),
  ('dry_rosin','collection-custom',10),('dry_rosin','not-specified',20),
  ('dry_rosin','pressing-bag-15-um',110),('dry_rosin','pressing-bag-25-um',120),
  ('dry_rosin','pressing-bag-37-um',130),('dry_rosin','pressing-bag-45-um',140),
  ('dry_rosin','pressing-bag-73-um',150),('dry_rosin','pressing-bag-custom',160),
  ('dry_rosin','pressing-bag-not-specified',170),
  ('flower_rosin','pressing-bag-75-um',10),('flower_rosin','pressing-bag-90-um',20),
  ('flower_rosin','pressing-bag-120-um',30),('flower_rosin','pressing-bag-160-um',40),
  ('flower_rosin','pressing-bag-custom',50),
  ('flower_rosin','pressing-bag-not-specified',60)
)
insert into public.subcategory_micron_presets(subcategory_id,micron_preset_id,sort_order)
select s.id,p.id,a.sort_order
from targets t join allowed a on a.group_key=t.group_key
join public.categories c on c.slug=t.category_slug and c.deleted_at is null
join public.subcategories s on s.category_id=c.id and s.slug=t.subcategory_slug
  and s.deleted_at is null
join public.micron_presets p on p.slug=a.preset_slug and p.is_active
on conflict(subcategory_id,micron_preset_id) do update set sort_order=excluded.sort_order;

update public.subcategories s set
  technical_name=case s.slug
    when 'dry-sift' then 'Dry Sift' when 'static-sift' then 'Static Sift'
    when 'frozen-dry-sift' then 'Frozen Dry Sift'
    when 'static-tech' then 'Static Tech'
    when 'dry-sift-presse' then 'Pressed Dry Sift'
    when 'dry-sift-non-presse' then 'Unpressed Dry Sift'
    when 'full-spectrum-dry-sift' then 'Full Spectrum Dry Sift'
    when 'single-fraction' then 'Single Fraction'
    when 'mixed-fraction' then 'Mixed Fraction'
    when 'pressed-hash' then 'Pressed Hash'
    when 'pollen-kief-presse' then 'Pressed Pollen / Kief'
    when 'bubble-hash' then 'Bubble Hash' when 'ice-water-hash' then 'Ice Water Hash'
    when 'flower-rosin' then 'Flower Rosin' when 'hash-rosin' then 'Hash Rosin'
    when 'live-rosin' then 'Live Rosin' else technical_name end,
  display_name=coalesce(display_name,s.name),
  french_explanation=case s.slug
    when 'dry-sift' then 'Tamisage a sec des trichomes'
    when 'static-sift' then 'Dry sift purifie par separation statique'
    when 'frozen-dry-sift' then 'Dry sift issu de matière congelée'
    when 'static-tech' then 'Dry sift purifié par séparation statique'
    when 'dry-sift-presse' then 'Dry sift présenté sous forme pressée'
    when 'dry-sift-non-presse' then 'Dry sift présenté sans pressage'
    when 'full-spectrum-dry-sift' then 'Dry sift déclaré à spectre complet'
    when 'single-fraction' then 'Fraction unique de dry sift déclarée'
    when 'mixed-fraction' then 'Assemblage de fractions de dry sift déclarées'
    when 'pressed-hash' then 'Hash traditionnel présenté sous forme pressée'
    when 'pollen-kief-presse' then 'Pollen ou kief présenté sous forme pressée'
    when 'bubble-hash' then 'Hash separe a l''eau glacee'
    when 'ice-water-hash' then 'Separation mecanique a l''eau glacee'
    when 'flower-rosin' then 'Rosin de fleur obtenu par pression sans solvant'
    when 'hash-rosin' then 'Rosin presse a partir de hash'
    when 'live-rosin' then 'Rosin issu de matiere fraiche congelee'
    else french_explanation end
where s.slug in ('dry-sift','frozen-dry-sift','dry-sift-presse','dry-sift-non-presse',
  'full-spectrum-dry-sift','single-fraction','mixed-fraction','static-sift','static-tech',
  'pressed-hash','pollen-kief-presse','bubble-hash','ice-water-hash',
  'flower-rosin','hash-rosin','live-rosin');
update public.subcategories s set
  micron_requirement='OPTIONAL',
  allowed_micron_contexts=case
    when s.slug in ('flower-rosin','hash-rosin','live-rosin')
      then array['COLLECTION_SEPARATION','PRESSING_BAG']::public.micron_context_type[]
    else array['COLLECTION_SEPARATION']::public.micron_context_type[] end
where s.slug in ('dry-sift','frozen-dry-sift','dry-sift-presse','dry-sift-non-presse',
  'full-spectrum-dry-sift','single-fraction','mixed-fraction','static-sift','static-tech',
  'bubble-hash','ice-water-hash','flower-rosin','hash-rosin','live-rosin');

-- Etat contextuel de la matière de départ pour les produits Frozen / Fresh Frozen.
with targets(category_slug,subcategory_slug,sort_order) as (values
  ('hash','frozen-dry-sift',35),
  ('hash','bubble-hash',35),('hash','ice-water-hash',35),
  ('rosin','live-rosin',35),
  ('extractions-solvants','live-resin',35),
  ('concentres-sans-solvant','bubble-hash',35),
  ('concentres-sans-solvant','ice-water-hash',35),
  ('concentres-sans-solvant','live-rosin',35)
)
insert into public.dynamic_field_definitions(
  category_id,subcategory_id,key,label,description,field_type,is_required,
  is_filterable,is_searchable,is_visible,sort_order,deleted_at
)
select c.id,s.id,'starting_material_state','État de la matière de départ',
  'État déclaré de la matière avant transformation.','SELECT',false,true,false,true,
  t.sort_order,null
from targets t
join public.categories c on c.slug=t.category_slug and c.deleted_at is null
join public.subcategories s on s.category_id=c.id and s.slug=t.subcategory_slug
  and s.deleted_at is null
on conflict do nothing;

with targets(category_slug,subcategory_slug,sort_order) as (values
  ('hash','frozen-dry-sift',35),
  ('hash','bubble-hash',35),('hash','ice-water-hash',35),
  ('rosin','live-rosin',35),
  ('extractions-solvants','live-resin',35),
  ('concentres-sans-solvant','bubble-hash',35),
  ('concentres-sans-solvant','ice-water-hash',35),
  ('concentres-sans-solvant','live-rosin',35)
)
update public.dynamic_field_definitions d set
  label='État de la matière de départ',
  description='État déclaré de la matière avant transformation.',
  field_type='SELECT',is_required=false,is_filterable=true,is_searchable=false,
  is_visible=true,sort_order=t.sort_order,deleted_at=null,updated_at=now()
from targets t
join public.categories c on c.slug=t.category_slug and c.deleted_at is null
join public.subcategories s on s.category_id=c.id and s.slug=t.subcategory_slug
  and s.deleted_at is null
where d.category_id=c.id and d.subcategory_id=s.id and d.key='starting_material_state';

with option_values(value,label,technical_name,display_name,french_explanation,sort_order) as (values
  ('dried-cured','Séchée / Cured','Dried / Cured','Séchée / Cured',
    'Matière séchée ou affinée avant transformation.',10),
  ('fresh-frozen','Fresh Frozen','Fresh Frozen','Fresh Frozen',
    'Matière fraîche congelée rapidement après récolte.',20),
  ('frozen','Frozen','Frozen','Frozen','Matière congelée.',30),
  ('not-specified','Non précisé','Not specified','Non précisé',
    'État de la matière non déclaré.',40)
)
insert into public.dynamic_field_options(
  field_definition_id,value,label,technical_name,display_name,french_explanation,
  description,sort_order,is_active
)
select d.id,v.value,v.label,v.technical_name,v.display_name,v.french_explanation,
  v.french_explanation,v.sort_order,true
from public.dynamic_field_definitions d
join public.subcategories s on s.id=d.subcategory_id and s.deleted_at is null
join public.categories c on c.id=d.category_id and c.deleted_at is null
cross join option_values v
where d.key='starting_material_state' and d.deleted_at is null
  and (c.slug,s.slug) in (
    ('hash','frozen-dry-sift'),('hash','bubble-hash'),('hash','ice-water-hash'),
    ('rosin','live-rosin'),('extractions-solvants','live-resin'),
    ('concentres-sans-solvant','bubble-hash'),
    ('concentres-sans-solvant','ice-water-hash'),
    ('concentres-sans-solvant','live-rosin')
  )
on conflict(field_definition_id,value) do update set
  label=excluded.label,technical_name=excluded.technical_name,
  display_name=excluded.display_name,french_explanation=excluded.french_explanation,
  description=excluded.description,sort_order=excluded.sort_order,is_active=true,
  updated_at=now();

-- Complète les textures Rosin demandées et leurs explications françaises.
with option_values(value,label,technical_name,display_name,french_explanation,sort_order) as (values
  ('sauce-like','Sauce-like','Sauce-like','Sauce-like','Texture fluide rappelant une sauce.',130),
  ('autre','Autre','Other','Autre','Autre texture déclarée.',140)
)
insert into public.dynamic_field_options(
  field_definition_id,value,label,technical_name,display_name,french_explanation,
  description,sort_order,is_active
)
select d.id,v.value,v.label,v.technical_name,v.display_name,v.french_explanation,
  v.french_explanation,v.sort_order,true
from public.categories c
join public.dynamic_field_definitions d on d.category_id=c.id
  and d.subcategory_id is null and d.key='texture' and d.deleted_at is null
cross join option_values v
where c.slug='rosin' and c.deleted_at is null
on conflict(field_definition_id,value) do update set
  label=excluded.label,technical_name=excluded.technical_name,
  display_name=excluded.display_name,french_explanation=excluded.french_explanation,
  description=excluded.description,sort_order=excluded.sort_order,is_active=true,
  updated_at=now();

update public.dynamic_field_options o set
  technical_name=case o.value
    when 'fresh-press' then 'Fresh Press' when 'cold-cure' then 'Cold Cure'
    when 'coins' then 'Coin' else o.technical_name end,
  display_name=case o.value
    when 'fresh-press' then 'Fresh Press' when 'cold-cure' then 'Cold Cure'
    when 'coins' then 'Coin' else coalesce(o.display_name,o.label) end,
  french_explanation=case o.value
    when 'fresh-press' then 'Rosin fraîchement pressé'
    when 'cold-cure' then 'Texture obtenue après maturation à froid'
    when 'coins' then 'Rosin présenté sous forme de disque'
    else o.french_explanation end,
  label=case when o.value='coins' then 'Coin' else o.label end,
  updated_at=now()
from public.dynamic_field_definitions d
join public.categories c on c.id=d.category_id
where o.field_definition_id=d.id and c.slug='rosin' and d.key='texture'
  and d.subcategory_id is null and o.value in ('fresh-press','cold-cure','coins');

-- RLS prive par defaut. Seuls les microns de fiches publiees sont publics.
alter table public.review_moderation_events enable row level security;
alter table public.user_notifications enable row level security;
alter table public.user_sessions enable row level security;
alter table public.user_activity_events enable row level security;
alter table public.admin_outbound_messages enable row level security;
alter table public.user_moderation_events enable row level security;
alter table public.admin_user_notes enable row level security;
alter table public.role_history enable row level security;
alter table public.user_permissions enable row level security;
alter table public.entry_micron_contexts enable row level security;
alter table public.subcategory_micron_presets enable row level security;

drop policy if exists public_entry_micron_contexts_read on public.entry_micron_contexts;
create policy public_entry_micron_contexts_read on public.entry_micron_contexts
  for select to anon,authenticated using(
    exists(select 1 from public.entries e where e.id=entry_id
      and e.status='PUBLISHED' and e.deleted_at is null)
  );
drop policy if exists public_subcategory_micron_presets_read on public.subcategory_micron_presets;
create policy public_subcategory_micron_presets_read on public.subcategory_micron_presets
  for select to anon,authenticated using(
    exists(select 1 from public.subcategories s join public.categories c on c.id=s.category_id
      where s.id=subcategory_id and s.is_visible and s.deleted_at is null
        and c.is_visible and c.deleted_at is null)
    and exists(select 1 from public.micron_presets p
      where p.id=micron_preset_id and p.is_active)
  );
drop policy if exists public_contests_read on public.contests;
create policy public_contests_read on public.contests for select to anon,authenticated
  using(deleted_at is null and status::text in
    ('SCHEDULED','ACTIVE','PAUSED','ENDED','UPCOMING','OPEN','FULL','CLOSED'));
drop policy if exists public_contest_participations_read on public.contest_participations;
create policy public_contest_participations_read on public.contest_participations
  for select to anon,authenticated using(
    status='APPROVED'
    and exists(select 1 from public.contests c
      where c.id=contest_participations.contest_id and c.deleted_at is null
        and c.status::text in ('SCHEDULED','ACTIVE','PAUSED','ENDED','UPCOMING','OPEN','FULL','CLOSED'))
    and exists(select 1 from public.users u where u.id=contest_participations.user_id
      and u.account_kind='TELEGRAM' and not u.is_system
      and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED')
    and (entry_id is null or exists(select 1 from public.entries e
      where e.id=contest_participations.entry_id
        and e.status='PUBLISHED' and e.deleted_at is null))
  );
drop policy if exists public_contest_winners_read on public.contest_winners;
create policy public_contest_winners_read on public.contest_winners
  for select to anon,authenticated using(
    exists(select 1 from public.contest_participations p
      join public.users u on u.id=p.user_id
      where p.id=contest_winners.participation_id
        and p.contest_id=contest_winners.contest_id and p.status='APPROVED'
        and u.account_kind='TELEGRAM' and not u.is_system
        and u.profile_visibility='PUBLIC' and not u.is_banned and u.role<>'BANNED')
    and exists(select 1 from public.contests c where c.id=contest_winners.contest_id
      and c.deleted_at is null
      and c.status::text in ('SCHEDULED','ACTIVE','PAUSED','ENDED','UPCOMING','OPEN','FULL','CLOSED'))
  );

revoke all privileges on public.review_moderation_events,public.user_notifications,
  public.user_sessions,public.user_activity_events,public.admin_outbound_messages,
  public.user_moderation_events,public.admin_user_notes,public.role_history,
  public.user_permissions,public.entry_micron_contexts from anon,authenticated;
revoke all privileges on public.subcategory_micron_presets from anon,authenticated;
grant select(id,entry_id,context,mode,single_value,minimum_value,maximum_value,multiple_values,
  is_full_spectrum,is_mixed_micron,display_label,source_type,notes,created_at,updated_at)
  on public.entry_micron_contexts to anon,authenticated;
grant select(subcategory_id,micron_preset_id,sort_order,created_at)
  on public.subcategory_micron_presets to anon,authenticated;
grant select(contest_type,instructions,participation_steps,external_url,telegram_url,
  instagram_url,terms,additional_information,registrations_open,registration_starts_at,
  registration_ends_at,registrations_closed_at) on public.contests to anon,authenticated;
grant all privileges on public.review_moderation_events,public.user_notifications,
  public.user_sessions,public.user_activity_events,public.admin_outbound_messages,
  public.user_moderation_events,public.admin_user_notes,public.role_history,
  public.user_permissions,public.entry_micron_contexts to service_role;
grant all privileges on public.subcategory_micron_presets to service_role;

-- Evolution 007: durcissement capacite des concours et taxonomie Ice Hash.
create or replace function public.enforce_contest_capacity_floor()
returns trigger language plpgsql security definer set search_path='' as $$
declare occupied_places bigint;
begin
  if new.max_participants is not distinct from old.max_participants then return new; end if;
  select count(*) into occupied_places
  from public.contest_participations p
  where p.contest_id=old.id
    and p.status in ('PENDING_REVIEW','APPROVED');
  if new.max_participants is not null and new.max_participants<occupied_places then
    raise exception 'contest_capacity_below_occupied'
      using errcode='23514',
        detail=format('requested=%s occupied=%s',new.max_participants,occupied_places);
  end if;
  if new.max_participants is not null and occupied_places>=new.max_participants
      and new.status::text in ('ACTIVE','OPEN') then
    new.status='FULL';
  elsif (new.max_participants is null or occupied_places<new.max_participants)
      and new.status::text='FULL' and new.registrations_open
      and now()>=coalesce(new.registration_starts_at,new.starts_at)
      and now()<coalesce(new.registration_ends_at,new.ends_at) then
    new.status='OPEN';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_contest_capacity_floor()
  from public,anon,authenticated;
grant execute on function public.enforce_contest_capacity_floor() to service_role;
drop trigger if exists enforce_contest_capacity_floor on public.contests;
create trigger enforce_contest_capacity_floor before update of max_participants
  on public.contests for each row
  execute function public.enforce_contest_capacity_floor();

-- Normalise tous les compteurs de capacite sur les statuts qui occupent
-- reellement une place. WITHDRAWN, REJECTED et DISQUALIFIED sont exclus.
create or replace function public.enforce_contest_participation_quota()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  contest_row public.contests%rowtype;
  occupied_places bigint;
  opens_at timestamptz;
  closes_at timestamptz;
begin
  if tg_op='UPDATE' then
    if new.status not in ('PENDING_REVIEW','APPROVED') then return new; end if;
    if new.contest_id=old.contest_id
      and old.status in ('PENDING_REVIEW','APPROVED') then return new; end if;
    if new.contest_id<>old.contest_id then
      perform 1 from public.contests c
      where c.id in (old.contest_id,new.contest_id)
      order by c.id for update;
    end if;
  end if;
  select * into contest_row from public.contests
    where id=new.contest_id and deleted_at is null for update;
  if not found then raise exception 'contest_not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.users u where u.id=new.user_id) then
    raise exception 'user_not_found' using errcode='P0002';
  end if;
  if exists(select 1 from public.users u where u.id=new.user_id
      and (u.is_banned or u.role='BANNED'
        or (u.banned_until is not null and u.banned_until>now()))) then
    raise exception 'user_banned' using errcode='42501';
  end if;
  opens_at:=coalesce(contest_row.registration_starts_at,contest_row.starts_at);
  closes_at:=coalesce(contest_row.registration_ends_at,contest_row.ends_at);
  if not contest_row.registrations_open or contest_row.status::text not in ('ACTIVE','OPEN')
    or now()<opens_at or now()>=closes_at then
    raise exception 'contest_registrations_closed' using errcode='23514';
  end if;
  if contest_row.require_entry and new.entry_id is null then
    raise exception 'contest_entry_required' using errcode='23514';
  end if;
  if new.entry_id is not null
    and not exists(select 1 from public.entries e where e.id=new.entry_id) then
    raise exception 'contest_entry_not_found' using errcode='23503';
  end if;
  if contest_row.max_participants is not null then
    select count(*) into occupied_places from public.contest_participations p
      where p.contest_id=new.contest_id
        and p.status in ('PENDING_REVIEW','APPROVED');
    if occupied_places>=contest_row.max_participants then
      raise exception 'contest_full' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_contest_participation_quota()
  from public,anon,authenticated;
grant execute on function public.enforce_contest_participation_quota() to service_role;

create or replace function public.contest_participant_count(p_contest_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
  select count(*)::bigint from public.contest_participations p
  where p.contest_id=p_contest_id
    and p.status in ('PENDING_REVIEW','APPROVED')
$$;
revoke execute on function public.contest_participant_count(uuid)
  from public,anon,authenticated;
grant execute on function public.contest_participant_count(uuid) to service_role;

create or replace function public.sync_contest_full_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_id uuid; contest_row public.contests%rowtype; occupied bigint;
begin
  for target_id in
    select candidate.contest_id
    from unnest(array[
      case when tg_op<>'DELETE' then new.contest_id end,
      case when tg_op<>'INSERT' then old.contest_id end
    ]::uuid[]) as candidate(contest_id)
    where candidate.contest_id is not null
    group by candidate.contest_id
    order by candidate.contest_id
  loop
    select * into contest_row from public.contests where id=target_id for update;
    if found and contest_row.max_participants is not null then
      select count(*) into occupied from public.contest_participations p
        where p.contest_id=target_id
          and p.status in ('PENDING_REVIEW','APPROVED');
      if occupied>=contest_row.max_participants
          and contest_row.status::text in ('ACTIVE','OPEN') then
        execute 'update public.contests set status=$1::public.contest_status,updated_at=now() where id=$2'
          using 'FULL',target_id;
      elsif occupied<contest_row.max_participants and contest_row.status::text='FULL'
          and contest_row.registrations_open
          and now()>=coalesce(contest_row.registration_starts_at,contest_row.starts_at)
          and now()<coalesce(contest_row.registration_ends_at,contest_row.ends_at) then
        execute 'update public.contests set status=$1::public.contest_status,updated_at=now() where id=$2'
          using 'OPEN',target_id;
      end if;
    end if;
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.sync_contest_full_status()
  from public,anon,authenticated;
grant execute on function public.sync_contest_full_status() to service_role;

-- Ice Hash est une vraie sous-categorie, avec traduction, champ Fresh/Frozen
-- contextuel et presets de collecte identiques aux familles eau/glace.
insert into public.subcategories(category_id,slug,name,description,sort_order)
select c.id,'ice-hash','Ice Hash','Hash séparé mécaniquement à l’eau glacée',35
from public.categories c
where c.slug in ('hash','concentres-sans-solvant') and c.deleted_at is null
on conflict(category_id,slug) do update set
  name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,
  is_visible=true,deleted_at=null,updated_at=now();

update public.subcategories s set
  technical_name='Ice Hash',display_name='Ice Hash',
  french_explanation='Hash séparé mécaniquement à l’eau glacée',
  micron_requirement='OPTIONAL',
  allowed_micron_contexts=array['COLLECTION_SEPARATION']::public.micron_context_type[],
  updated_at=now()
from public.categories c
where c.id=s.category_id and c.slug in ('hash','concentres-sans-solvant')
  and s.slug='ice-hash' and s.deleted_at is null;

with targets(category_slug,subcategory_slug) as (values
  ('hash','ice-hash'),('concentres-sans-solvant','ice-hash')
), allowed(preset_slug,sort_order) as (values
  ('220-um',10),('190-um',20),('160-um',30),('120-um',40),
  ('90-um',50),('73-um',60),('45-um',70),('25-um',80),
  ('45-159-um',90),('73-159-um',100),('90-120-um',110),('73-120-um',120),
  ('full-spectrum',130),('mixed-micron',140),('collection-custom',150),
  ('not-specified',160)
)
insert into public.subcategory_micron_presets(subcategory_id,micron_preset_id,sort_order)
select s.id,p.id,a.sort_order
from targets t
join public.categories c on c.slug=t.category_slug and c.deleted_at is null
join public.subcategories s on s.category_id=c.id and s.slug=t.subcategory_slug
  and s.deleted_at is null
cross join allowed a
join public.micron_presets p on p.slug=a.preset_slug
  and p.context='COLLECTION_SEPARATION' and p.is_active
on conflict(subcategory_id,micron_preset_id) do update set sort_order=excluded.sort_order;

insert into public.dynamic_field_definitions(
  category_id,subcategory_id,key,label,description,field_type,is_required,
  is_filterable,is_searchable,is_visible,sort_order,deleted_at
)
select c.id,s.id,'starting_material_state','État de la matière de départ',
  'État déclaré de la matière avant transformation.','SELECT',false,true,false,true,35,null
from public.categories c
join public.subcategories s on s.category_id=c.id and s.slug='ice-hash'
  and s.deleted_at is null
where c.slug in ('hash','concentres-sans-solvant') and c.deleted_at is null
on conflict do nothing;

update public.dynamic_field_definitions d set
  label='État de la matière de départ',
  description='État déclaré de la matière avant transformation.',
  field_type='SELECT',is_required=false,is_filterable=true,is_searchable=false,
  is_visible=true,sort_order=35,deleted_at=null,updated_at=now()
from public.categories c
join public.subcategories s on s.category_id=c.id and s.slug='ice-hash'
  and s.deleted_at is null
where d.category_id=c.id and d.subcategory_id=s.id and d.key='starting_material_state'
  and c.slug in ('hash','concentres-sans-solvant') and c.deleted_at is null;

with option_values(value,label,technical_name,display_name,french_explanation,sort_order) as (values
  ('dried-cured','Séchée / Cured','Dried / Cured','Séchée / Cured',
    'Matière séchée ou affinée avant transformation.',10),
  ('fresh-frozen','Fresh Frozen','Fresh Frozen','Fresh Frozen',
    'Matière fraîche congelée rapidement après récolte.',20),
  ('frozen','Frozen','Frozen','Frozen','Matière congelée.',30),
  ('not-specified','Non précisé','Not specified','Non précisé',
    'État de la matière non déclaré.',40)
)
insert into public.dynamic_field_options(
  field_definition_id,value,label,technical_name,display_name,french_explanation,
  description,sort_order,is_active
)
select d.id,v.value,v.label,v.technical_name,v.display_name,v.french_explanation,
  v.french_explanation,v.sort_order,true
from public.dynamic_field_definitions d
join public.subcategories s on s.id=d.subcategory_id and s.slug='ice-hash'
join public.categories c on c.id=d.category_id
cross join option_values v
where d.key='starting_material_state' and d.deleted_at is null
  and c.slug in ('hash','concentres-sans-solvant') and c.deleted_at is null
on conflict(field_definition_id,value) do update set
  label=excluded.label,technical_name=excluded.technical_name,
  display_name=excluded.display_name,french_explanation=excluded.french_explanation,
  description=excluded.description,sort_order=excluded.sort_order,is_active=true,
  updated_at=now();

-- Evolution 008: gestion editoriale, age gate et preparation partenariats.
alter type public.user_notification_type add value if not exists 'ENTRY_CHANGES_REQUESTED';

do $$ begin
  create type public.partnership_type as enum
    ('COMMUNITY','OFFICIAL','SPONSORED','TEMPORARY','PREMIUM');
exception when duplicate_object then null;
end $$;

alter table public.partners
  add column if not exists partnership_type public.partnership_type not null default 'COMMUNITY';
alter table public.user_profile_settings
  add column if not exists age_gate_confirmed_at timestamptz;

comment on column public.partners.partnership_type is
  'Classification editoriale preparee pour les futurs partenariats; aucune logique commerciale.';
comment on column public.user_profile_settings.age_gate_confirmed_at is
  'Date de declaration 18+; ne contient jamais de date de naissance.';

-- Evolution 009: experience concours, jeu du poids, statistiques, gagnants et diffusion.
do $$ begin
  create type public.contest_link_type as enum ('WEBSITE','TELEGRAM','INSTAGRAM','OTHER');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contest_link_visibility as enum ('PUBLIC','PARTICIPANTS_ONLY');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contest_tie_breaker_mode as enum ('FIRST_SUBMISSION','RANDOM','MANUAL');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contest_result_publication_mode as enum ('MANUAL','AUTOMATIC');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contest_event_type as enum ('PAGE_VIEW','JOIN_CLICK','LINK_CLICK');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contest_winner_history_action as enum ('SELECTED','REPLACED','REMOVED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.telegram_broadcast_type as enum ('CONTEST_NEW','CONTEST_RESULT','CONTEST_WINNER');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.telegram_broadcast_status as enum ('QUEUED','PROCESSING','COMPLETED','PARTIAL','FAILED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.telegram_delivery_status as enum ('QUEUED','SENT','FAILED','BLOCKED','RETRY');
exception when duplicate_object then null; end $$;

alter table public.contests
  alter column summary drop not null,
  alter column description drop not null,
  alter column rules drop not null,
  add column if not exists short_description text,
  add column if not exists public_intro text,
  add column if not exists participant_instructions text,
  add column if not exists short_rules text,
  add column if not exists full_rules text,
  add column if not exists long_description text,
  add column if not exists main_image_url text,
  add column if not exists result_image_url text,
  add column if not exists main_image_bucket text,
  add column if not exists main_image_path text,
  add column if not exists result_image_bucket text,
  add column if not exists result_image_path text,
  add column if not exists result_text text,
  add column if not exists registrations_manually_closed boolean not null default false,
  add column if not exists result_publication_mode public.contest_result_publication_mode not null default 'MANUAL',
  add column if not exists result_published_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists secret_weight numeric(18,6),
  add column if not exists weight_unit text,
  add column if not exists custom_weight_unit text,
  add column if not exists allow_guess_editing boolean not null default false,
  add column if not exists tie_breaker_mode public.contest_tie_breaker_mode not null default 'MANUAL',
  add column if not exists notify_telegram_on_publish boolean not null default false,
  add column if not exists notify_participants_on_result boolean not null default false;

alter table public.user_profile_settings
  add column if not exists notify_contests boolean not null default true;

update public.contests set
  short_description=coalesce(short_description,nullif(summary,'')),
  public_intro=coalesce(public_intro,nullif(description,'')),
  participant_instructions=coalesce(participant_instructions,nullif(instructions,'')),
  full_rules=coalesce(full_rules,nullif(rules,'')),
  long_description=coalesce(long_description,nullif(description,'')),
  published_at=case when status::text<>'DRAFT' then coalesce(published_at,created_at) else published_at end
where short_description is null or public_intro is null or participant_instructions is null
  or full_rules is null or long_description is null or published_at is null;

do $$ begin
  alter table public.contests add constraint contests_optional_text_lengths check(
    (short_description is null or char_length(short_description)<=320)
    and (public_intro is null or char_length(public_intro)<=20000)
    and (participant_instructions is null or char_length(participant_instructions)<=20000)
    and (short_rules is null or char_length(short_rules)<=2000)
    and (full_rules is null or char_length(full_rules)<=20000)
    and (long_description is null or char_length(long_description)<=20000)
    and (result_text is null or char_length(result_text)<=20000)
  );
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_experience_image_urls_http check(
    (main_image_url is null or main_image_url ~ '^https?://')
    and (result_image_url is null or result_image_url ~ '^https?://')
  );
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_image_storage_consistency check(
    (main_image_bucket is null and main_image_path is null)
      or (main_image_bucket='contest-images' and main_image_path is not null)
  ) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_result_image_storage_consistency check(
    (result_image_bucket is null and result_image_path is null)
      or (result_image_bucket='contest-results' and result_image_path is not null)
  ) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_weight_guess_configuration check(
    contest_type::text<>'WEIGHT_GUESS'
    or (secret_weight is not null and secret_weight>0 and weight_unit in ('mg','g','kg','CUSTOM')
      and (weight_unit<>'CUSTOM' or nullif(btrim(custom_weight_unit),'') is not null))
  ) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.contests add constraint contests_result_publication_consistency check(
    result_published_at is null or result_published_at>=coalesce(published_at,created_at)
  ) not valid;
exception when duplicate_object then null; end $$;

create table if not exists public.contest_links (
  id uuid primary key default extensions.gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  label text not null check(char_length(btrim(label)) between 1 and 120),
  url text not null check(url ~ '^https?://'),
  type public.contest_link_type not null default 'WEBSITE',
  visibility public.contest_link_visibility not null default 'PUBLIC',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contest_links_contest_visibility_order_idx
  on public.contest_links(contest_id,visibility,display_order,id);
drop trigger if exists set_updated_at on public.contest_links;
create trigger set_updated_at before update on public.contest_links
  for each row execute function public.set_updated_at();

insert into public.contest_links(contest_id,label,url,type,visibility,display_order)
select c.id,v.label,v.url,v.type::public.contest_link_type,'PARTICIPANTS_ONLY',v.display_order
from public.contests c
cross join lateral (values
  ('Lien du concours',c.external_url,'WEBSITE',0),
  ('Telegram',c.telegram_url,'TELEGRAM',1),
  ('Instagram',c.instagram_url,'INSTAGRAM',2)
) as v(label,url,type,display_order)
where v.url is not null
  and not exists(select 1 from public.contest_links l where l.contest_id=c.id and l.url=v.url);

create table if not exists public.contest_guesses (
  id uuid primary key default extensions.gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  participation_id uuid not null,
  numeric_value numeric(18,6) not null check(numeric_value>0),
  unit text not null check(unit in ('mg','g','kg','CUSTOM')),
  submission_count integer not null default 1 check(submission_count>0),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contest_id,user_id),
  foreign key(participation_id,contest_id)
    references public.contest_participations(id,contest_id) on delete cascade
);
create index if not exists contest_guesses_contest_value_idx
  on public.contest_guesses(contest_id,numeric_value,submitted_at);
create index if not exists contest_guesses_user_updated_idx
  on public.contest_guesses(user_id,updated_at desc);

create table if not exists public.contest_winner_history (
  id uuid primary key default extensions.gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  action public.contest_winner_history_action not null,
  previous_winner_user_id uuid references public.users(id) on delete set null,
  winner_user_id uuid references public.users(id) on delete set null,
  selected_by_id uuid references public.users(id) on delete set null,
  selected_by_role public.user_role,
  reason text check(reason is null or char_length(reason)<=2000),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index if not exists contest_winner_history_contest_created_idx
  on public.contest_winner_history(contest_id,created_at desc);

create table if not exists public.contest_view_events (
  id uuid primary key default extensions.gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_type public.contest_event_type not null,
  session_key_hash text,
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index if not exists contest_view_events_contest_type_created_idx
  on public.contest_view_events(contest_id,event_type,created_at desc);
create index if not exists contest_view_events_user_created_idx
  on public.contest_view_events(user_id,created_at desc) where user_id is not null;

create table if not exists public.telegram_broadcasts (
  id uuid primary key default extensions.gen_random_uuid(),
  type public.telegram_broadcast_type not null,
  contest_id uuid not null references public.contests(id) on delete cascade,
  created_by_id uuid references public.users(id) on delete set null,
  status public.telegram_broadcast_status not null default 'QUEUED',
  payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
  total_recipients integer not null default 0 check(total_recipients>=0),
  sent_count integer not null default 0 check(sent_count>=0),
  failed_count integer not null default 0 check(failed_count>=0),
  retry_count integer not null default 0 check(retry_count>=0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists telegram_broadcasts_status_created_idx
  on public.telegram_broadcasts(status,created_at);
create index if not exists telegram_broadcasts_contest_created_idx
  on public.telegram_broadcasts(contest_id,created_at desc);

create table if not exists public.telegram_broadcast_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  broadcast_id uuid not null references public.telegram_broadcasts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status public.telegram_delivery_status not null default 'QUEUED',
  telegram_message_id bigint,
  attempt_count integer not null default 0 check(attempt_count>=0),
  next_attempt_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(broadcast_id,user_id)
);
create index if not exists telegram_broadcast_deliveries_queue_idx
  on public.telegram_broadcast_deliveries(status,next_attempt_at,created_at)
  where status in ('QUEUED','RETRY');
drop trigger if exists set_updated_at on public.telegram_broadcast_deliveries;
create trigger set_updated_at before update on public.telegram_broadcast_deliveries
  for each row execute function public.set_updated_at();

alter table public.contest_links enable row level security;
alter table public.contest_guesses enable row level security;
alter table public.contest_winner_history enable row level security;
alter table public.contest_view_events enable row level security;
alter table public.telegram_broadcasts enable row level security;
alter table public.telegram_broadcast_deliveries enable row level security;

drop policy if exists public_contest_links_read on public.contest_links;
create policy public_contest_links_read on public.contest_links for select to anon,authenticated
  using(visibility='PUBLIC' and exists(
    select 1 from public.contests c where c.id=contest_id and c.deleted_at is null
      and c.status::text not in ('DRAFT','CANCELLED')
  ));

revoke all privileges on public.contest_links,public.contest_guesses,
  public.contest_winner_history,public.contest_view_events,public.telegram_broadcasts,
  public.telegram_broadcast_deliveries from anon,authenticated;
grant select(id,contest_id,label,url,type,visibility,display_order,created_at,updated_at)
  on public.contest_links to anon,authenticated;
grant all privileges on public.contest_links,public.contest_guesses,
  public.contest_winner_history,public.contest_view_events,public.telegram_broadcasts,
  public.telegram_broadcast_deliveries to service_role;

-- Do not expose private contest columns or participant lists through the Data API.
revoke all privileges on public.contests,public.contest_participations,public.contest_winners
  from anon,authenticated;
grant select(id,slug,title,short_description,public_intro,short_rules,main_image_bucket,
  main_image_path,main_image_url,image_url,status,contest_type,is_featured,starts_at,ends_at,reward,
  max_participants,published_at,result_published_at,created_at,updated_at)
  on public.contests to anon,authenticated;
grant select(id,contest_id,participation_id,rank,label,prize,awarded_at)
  on public.contest_winners to anon,authenticated;

insert into public.permissions(code,name,description) values
  ('MANAGE_CONTEST_WINNER','Gérer le gagnant d''un concours',
    'Sélectionner, remplacer ou retirer le gagnant et publier le résultat')
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.role_permissions(role,permission_code) values
  ('OWNER','MANAGE_CONTEST_WINNER'),('ADMIN','MANAGE_CONTEST_WINNER')
on conflict do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('contest-images','contest-images',true,8388608,array['image/jpeg','image/png','image/webp','image/avif']),
  ('contest-results','contest-results',false,8388608,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.contest_effective_status(
  p_contest_id uuid,p_now timestamptz default now()
) returns text language sql stable security definer set search_path='' as $$
  select case
    when c.deleted_at is not null or c.status::text='CANCELLED' then 'CLOSED'
    when c.status::text='DRAFT' then 'DRAFT'
    when p_now>=coalesce(c.registration_ends_at,c.ends_at) then
      case when c.result_published_at is null then 'ENDED_PENDING_RESULT' else 'ENDED' end
    when c.registrations_manually_closed or not c.registrations_open
      or c.status::text='PAUSED' then 'CLOSED'
    when p_now<coalesce(c.registration_starts_at,c.starts_at) then 'UPCOMING'
    when c.max_participants is not null and public.contest_participant_count(c.id)>=c.max_participants
      then 'FULL'
    else 'OPEN'
  end
  from public.contests c where c.id=p_contest_id
$$;
revoke execute on function public.contest_effective_status(uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.contest_effective_status(uuid,timestamptz) to service_role;

-- The database guard uses the same effective dates as the public API. It no longer
-- rejects a valid registration because a legacy manual status was stale.
create or replace function public.enforce_contest_participation_quota()
returns trigger language plpgsql security definer set search_path='' as $$
declare contest_row public.contests%rowtype; occupied_places bigint;
  opens_at timestamptz; closes_at timestamptz;
begin
  if tg_op='UPDATE' then
    if new.status not in ('PENDING_REVIEW','APPROVED') then return new; end if;
    if new.contest_id=old.contest_id and old.status in ('PENDING_REVIEW','APPROVED') then return new; end if;
    if new.contest_id<>old.contest_id then
      perform 1 from public.contests c where c.id in (old.contest_id,new.contest_id)
        order by c.id for update;
    end if;
  end if;
  select * into contest_row from public.contests
    where id=new.contest_id and deleted_at is null for update;
  if not found then raise exception 'contest_not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.users u where u.id=new.user_id) then
    raise exception 'user_not_found' using errcode='P0002';
  end if;
  if exists(select 1 from public.users u where u.id=new.user_id and
      (u.is_banned or u.role='BANNED' or (u.banned_until is not null and u.banned_until>now()))) then
    raise exception 'user_banned' using errcode='42501';
  end if;
  opens_at:=coalesce(contest_row.registration_starts_at,contest_row.starts_at);
  closes_at:=coalesce(contest_row.registration_ends_at,contest_row.ends_at);
  if contest_row.status::text in ('DRAFT','CANCELLED','PAUSED')
    or not contest_row.registrations_open or contest_row.registrations_manually_closed
    or now()<opens_at or now()>=closes_at then
    raise exception 'contest_registrations_closed' using errcode='23514';
  end if;
  if contest_row.require_entry and new.entry_id is null then
    raise exception 'contest_entry_required' using errcode='23514';
  end if;
  if new.entry_id is not null and not exists(select 1 from public.entries e where e.id=new.entry_id) then
    raise exception 'contest_entry_not_found' using errcode='23503';
  end if;
  if contest_row.max_participants is not null then
    select count(*) into occupied_places from public.contest_participations p
      where p.contest_id=new.contest_id and p.status in ('PENDING_REVIEW','APPROVED');
    if occupied_places>=contest_row.max_participants then
      raise exception 'contest_full' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_contest_participation_quota()
  from public,anon,authenticated;
grant execute on function public.enforce_contest_participation_quota() to service_role;

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;

commit;
