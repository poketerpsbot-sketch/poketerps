-- Gestion editoriale des fiches, declaration d'age et preparation des partenariats.
-- Migration additive: aucune migration deja appliquee n'est modifiee.

alter type public.user_notification_type add value if not exists 'ENTRY_CHANGES_REQUESTED';

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

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

commit;
