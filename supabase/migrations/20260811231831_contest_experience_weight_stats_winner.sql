-- Contest experience, weight guessing, analytics, winners and reliable broadcasts.
-- Enum values must be committed before they are used by subsequent statements.
alter type public.contest_type add value if not exists 'WEIGHT_GUESS';
alter type public.contest_status add value if not exists 'ENDED_PENDING_RESULT';
alter type public.user_notification_type add value if not exists 'CONTEST_NEW';
alter type public.user_notification_type add value if not exists 'CONTEST_RESULT';
alter type public.user_notification_type add value if not exists 'CONTEST_WINNER';

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

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
