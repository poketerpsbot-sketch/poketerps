-- Concours communautaires, participations, classements et gagnants.
-- Cette migration est idempotente et ne publie aucun concours par défaut.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

do $$ begin create type public.contest_status as enum
  ('DRAFT','SCHEDULED','ACTIVE','PAUSED','ENDED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.contest_scoring_mode as enum
  ('MANUAL','ENTRY_LIKES','ENTRY_VIEWS','ENTRY_FAVORITES','ENTRY_RATING','COMPOSITE');
exception when duplicate_object then null; end $$;
do $$ begin create type public.contest_participation_status as enum
  ('PENDING_REVIEW','APPROVED','REJECTED','WITHDRAWN','DISQUALIFIED');
exception when duplicate_object then null; end $$;

create table if not exists public.contests (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  description text not null,
  rules text not null,
  image_url text,
  status public.contest_status not null default 'DRAFT',
  is_featured boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  scoring_mode public.contest_scoring_mode not null default 'MANUAL',
  criteria jsonb not null default '{}'::jsonb,
  reward jsonb not null default '{}'::jsonb,
  reward_badge_id uuid references public.badges(id) on delete set null,
  max_participants integer,
  require_entry boolean not null default true,
  created_by_id uuid not null references public.users(id) on delete restrict,
  updated_by_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contests_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint contests_title_length check (char_length(title) between 2 and 180),
  constraint contests_summary_length check (char_length(summary) between 2 and 320),
  constraint contests_description_length check (char_length(description) between 2 and 20000),
  constraint contests_rules_length check (char_length(rules) between 2 and 20000),
  constraint contests_image_url_http check
    (image_url is null or image_url ~ '^https?://'),
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
  statement text,
  manual_score numeric(14,4) not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  moderated_by_id uuid references public.users(id) on delete set null,
  moderated_at timestamptz,
  moderation_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint contest_participations_contest_user_unique unique(contest_id,user_id),
  constraint contest_participations_id_contest_unique unique(id,contest_id),
  constraint contest_participations_statement_length check
    (statement is null or char_length(statement)<=2000),
  constraint contest_participations_note_length check
    (moderation_note is null or char_length(moderation_note)<=2000),
  constraint contest_participations_score_object check
    (jsonb_typeof(score_breakdown)='object'),
  constraint contest_participations_withdrawal_consistency check
    ((status='WITHDRAWN' and withdrawn_at is not null)
      or (status<>'WITHDRAWN' and withdrawn_at is null))
);

create table if not exists public.contest_winners (
  id uuid primary key default extensions.gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  participation_id uuid not null,
  rank smallint not null,
  label text,
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
  on public.contests(status,starts_at,ends_at,is_featured)
  where deleted_at is null;
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
  from public.contests c
  join public.contest_participations p
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
    where not exists(
      select 1 from public.user_badges ub
      where ub.user_id=winning_user and ub.badge_id=badge_to_award
        and ub.is_active and ub.revoked_at is null
    ) on conflict do nothing;
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
    exists(select 1 from public.contest_participations p
      join public.users u on u.id=p.user_id
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

commit;
