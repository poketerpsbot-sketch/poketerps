-- Durcissement post-deploiement: capacite des concours et taxonomie Ice Hash.
-- 006 est deja appliquee en production et reste strictement immuable.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

-- Une reduction de capacite verrouille deja la ligne concours. Le comptage
-- execute dans ce trigger voit donc un etat serialise avec les inscriptions,
-- dont le trigger de quota verrouille la meme ligne.
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

commit;
