-- Allow the weight contest to store the two locked estimates requested by the rules.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

alter table public.contest_guesses
  add column if not exists attempt_number smallint not null default 1;

alter table public.contest_guesses
  drop constraint if exists contest_guesses_contest_id_user_id_key;

alter table public.contest_guesses
  drop constraint if exists contest_guesses_attempt_number_valid;

alter table public.contest_guesses
  add constraint contest_guesses_attempt_number_valid
  check (attempt_number between 1 and 2) not valid;

alter table public.contest_guesses
  add constraint contest_guesses_contest_user_attempt_key
  unique (contest_id, user_id, attempt_number);

create index if not exists contest_guesses_contest_attempt_idx
  on public.contest_guesses(contest_id, attempt_number, submitted_at);

commit;
