-- Extend the existing reliable Telegram broadcast queue to published entries.
-- Existing contest broadcasts remain valid and untouched.

do $$
begin
  alter type public.telegram_broadcast_type add value if not exists 'ENTRY_PUBLISHED';
exception
  when duplicate_object then null;
end $$;

alter table public.telegram_broadcasts
  alter column contest_id drop not null;

alter table public.telegram_broadcasts
  add column if not exists entry_id uuid references public.entries(id) on delete cascade;

alter table public.telegram_broadcasts
  drop constraint if exists telegram_broadcasts_single_target_check;

alter table public.telegram_broadcasts
  add constraint telegram_broadcasts_single_target_check check (
    (contest_id is not null and entry_id is null)
    or (contest_id is null and entry_id is not null)
  );

create index if not exists telegram_broadcasts_entry_created_idx
  on public.telegram_broadcasts(entry_id,created_at desc);

create unique index if not exists telegram_broadcasts_entry_published_unique
  on public.telegram_broadcasts(entry_id)
  where entry_id is not null;
