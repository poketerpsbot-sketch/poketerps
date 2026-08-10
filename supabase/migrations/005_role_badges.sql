-- Keep Telegram team-role badges aligned with the authoritative users.role value.
-- This migration is intentionally idempotent so it can be replayed safely.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

insert into public.badges(slug,name,description,icon,kind,criteria,is_active,sort_order) values
  ('role-owner','Propriétaire','Propriétaire officiel de la communauté','👑','ACTIVE',
    '{"system":"telegram-role","role":"OWNER","automatic":true}'::jsonb,true,1),
  ('role-admin','Administration','Membre de l’équipe d’administration','🛡️','ACTIVE',
    '{"system":"telegram-role","role":"ADMIN","automatic":true}'::jsonb,true,2),
  ('role-moderator','Modération','Membre de l’équipe de modération','🔎','ACTIVE',
    '{"system":"telegram-role","role":"MODERATOR","automatic":true}'::jsonb,true,3),
  ('role-editor','Rédaction','Membre de l’équipe éditoriale','✍️','ACTIVE',
    '{"system":"telegram-role","role":"EDITOR","automatic":true}'::jsonb,true,4)
on conflict(slug) do update set
  name=excluded.name,
  description=excluded.description,
  icon=excluded.icon,
  kind=excluded.kind,
  criteria=excluded.criteria,
  is_active=true,
  sort_order=excluded.sort_order;

create or replace function public.sync_user_role_badge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_slug text;
  desired_badge_id uuid;
begin
  desired_slug := case new.role::text
    when 'OWNER' then 'role-owner'
    when 'ADMIN' then 'role-admin'
    when 'MODERATOR' then 'role-moderator'
    when 'EDITOR' then 'role-editor'
    else null
  end;

  update public.user_badges ub
  set is_active=false,
      revoked_at=coalesce(ub.revoked_at,now()),
      revoke_reason='Rôle Telegram modifié',
      metadata=ub.metadata || jsonb_build_object(
        'source','role-sync',
        'revokedForRole',new.role::text
      )
  from public.badges b
  where ub.user_id=new.id
    and ub.badge_id=b.id
    and b.slug in ('role-owner','role-admin','role-moderator','role-editor')
    and (desired_slug is null or b.slug<>desired_slug)
    and ub.is_active
    and ub.revoked_at is null;

  if desired_slug is null then
    return new;
  end if;

  select b.id into desired_badge_id
  from public.badges b
  where b.slug=desired_slug and b.is_active;

  if desired_badge_id is null then
    return new;
  end if;

  update public.user_badges ub
  set active_from=coalesce(least(ub.active_from,now()),now()),
      active_until=null,
      metadata=ub.metadata || jsonb_build_object(
        'source','role-sync',
        'role',new.role::text,
        'automatic',true
      )
  where ub.user_id=new.id
    and ub.badge_id=desired_badge_id
    and ub.is_active
    and ub.revoked_at is null;

  if not found then
    insert into public.user_badges(
      user_id,badge_id,is_active,active_from,metadata
    ) values(
      new.id,desired_badge_id,true,now(),jsonb_build_object(
        'source','role-sync',
        'role',new.role::text,
        'automatic',true
      )
    );
  end if;

  return new;
end
$$;

revoke all on function public.sync_user_role_badge() from public,anon,authenticated;
grant execute on function public.sync_user_role_badge() to service_role;

drop trigger if exists sync_user_role_badge on public.users;
create trigger sync_user_role_badge
after insert or update of role on public.users
for each row execute function public.sync_user_role_badge();

-- Reconcile accounts created before this trigger existed.
update public.user_badges ub
set is_active=false,
    revoked_at=coalesce(ub.revoked_at,now()),
    revoke_reason='Rôle Telegram modifié',
    metadata=ub.metadata || jsonb_build_object(
      'source','role-sync',
      'revokedForRole',u.role::text
    )
from public.badges b,public.users u
where ub.user_id=u.id
  and ub.badge_id=b.id
  and b.slug in ('role-owner','role-admin','role-moderator','role-editor')
  and b.slug<>case u.role::text
    when 'OWNER' then 'role-owner'
    when 'ADMIN' then 'role-admin'
    when 'MODERATOR' then 'role-moderator'
    when 'EDITOR' then 'role-editor'
    else ''
  end
  and ub.is_active
  and ub.revoked_at is null;

with desired as (
  select u.id user_id,u.role::text role,b.id badge_id
  from public.users u
  join public.badges b on b.slug=case u.role::text
    when 'OWNER' then 'role-owner'
    when 'ADMIN' then 'role-admin'
    when 'MODERATOR' then 'role-moderator'
    when 'EDITOR' then 'role-editor'
    else null
  end
  where b.is_active
)
update public.user_badges ub
set active_from=coalesce(least(ub.active_from,now()),now()),
    active_until=null,
    metadata=ub.metadata || jsonb_build_object(
      'source','role-sync',
      'role',d.role,
      'automatic',true
    )
from desired d
where ub.user_id=d.user_id
  and ub.badge_id=d.badge_id
  and ub.is_active
  and ub.revoked_at is null;

insert into public.user_badges(user_id,badge_id,is_active,active_from,metadata)
select u.id,b.id,true,now(),jsonb_build_object(
  'source','role-sync',
  'role',u.role::text,
  'automatic',true
)
from public.users u
join public.badges b on b.slug=case u.role::text
  when 'OWNER' then 'role-owner'
  when 'ADMIN' then 'role-admin'
  when 'MODERATOR' then 'role-moderator'
  when 'EDITOR' then 'role-editor'
  else null
end
where b.is_active
  and not exists(
    select 1 from public.user_badges ub
    where ub.user_id=u.id
      and ub.badge_id=b.id
      and ub.is_active
      and ub.revoked_at is null
  );

commit;
