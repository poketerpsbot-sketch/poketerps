-- Navigation, moderation des avis, concours configurables, analytics et suivi equipe.
-- Cette migration est additive et idempotente. Elle conserve toutes les donnees existantes.

-- PostgreSQL exige que les nouvelles valeurs d'un enum soient validees avant leur usage.
-- Elles sont donc ajoutees avant la transaction principale, puis la transaction peut les utiliser.
alter type public.contest_status add value if not exists 'UPCOMING';
alter type public.contest_status add value if not exists 'OPEN';
alter type public.contest_status add value if not exists 'FULL';
alter type public.contest_status add value if not exists 'CLOSED';

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

do $$ begin create type public.review_moderation_action as enum
  ('SUBMITTED','CHANGES_REQUESTED','RESUBMITTED','APPROVED','REJECTED','HIDDEN','RESTORED','DELETED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.user_notification_type as enum
  ('REVIEW_APPROVED','REVIEW_REJECTED','REVIEW_CHANGES_REQUESTED','REVIEW_RESUBMITTED',
   'ENTRY_APPROVED','ENTRY_REJECTED','CONTEST','SYSTEM');
exception when duplicate_object then null; end $$;
do $$ begin create type public.contest_type as enum
  ('GAME','DRAW','CREATIVE','ENTRY','EXTERNAL_LINK','COMMUNITY','OTHER');
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

commit;
