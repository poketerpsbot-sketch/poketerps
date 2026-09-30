-- Add scheduled Telegram publication processing and announcement broadcasts.

do $$
begin
  alter type public.telegram_broadcast_type add value if not exists 'ANNOUNCEMENT';
exception
  when duplicate_object then null;
end $$;

alter table public.telegram_broadcasts
  alter column contest_id drop not null;

alter table public.telegram_broadcasts
  add column if not exists publication_id uuid
    references public.telegram_publications(id) on delete cascade;

alter table public.telegram_broadcasts
  drop constraint if exists telegram_broadcasts_single_target_check;

alter table public.telegram_broadcasts
  add constraint telegram_broadcasts_single_target_check check (
    (contest_id is not null and entry_id is null and publication_id is null)
    or (contest_id is null and entry_id is not null and publication_id is null)
    or (contest_id is null and entry_id is null and publication_id is not null)
  );

create index if not exists telegram_broadcasts_publication_created_idx
  on public.telegram_broadcasts(publication_id, created_at desc);

create unique index if not exists telegram_broadcasts_publication_unique
  on public.telegram_broadcasts(publication_id)
  where publication_id is not null;
