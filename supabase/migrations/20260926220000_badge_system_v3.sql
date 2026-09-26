begin;

-- Evolution badges V3 : une famille visuelle commune et des paliers de contribution.
-- Les slugs et les attributions existants restent valides ; cette évolution est additive.

update public.badges
set category = case
    when slug in ('role-owner','role-admin','role-moderator','role-editor') then 'ROLE'
    when slug like 'level-%' then 'LEVEL'
    when slug like 'captures-%' then 'ACHIEVEMENT'
    else category
  end,
  criteria = case
    when slug = 'captures-5' then jsonb_build_object('family','entry-contribution','metric','publishedEntries','threshold',5,'tier',1)
    when slug = 'captures-10' then jsonb_build_object('family','entry-contribution','metric','publishedEntries','threshold',10,'tier',2)
    when slug = 'captures-25' then jsonb_build_object('family','entry-contribution','metric','publishedEntries','threshold',25,'tier',3)
    when slug = 'captures-50' then jsonb_build_object('family','entry-contribution','metric','publishedEntries','threshold',50,'tier',4)
    when slug = 'captures-100' then jsonb_build_object('family','entry-contribution','metric','publishedEntries','threshold',100,'tier',5)
    when slug = 'captures-250' then jsonb_build_object('family','entry-contribution','metric','publishedEntries','threshold',250,'tier',6)
    else criteria
  end,
  updated_at = now()
where slug in ('role-owner','role-admin','role-moderator','role-editor',
  'captures-5','captures-10','captures-25','captures-50','captures-100','captures-250');

insert into public.badges(
  slug,name,description,icon,kind,criteria,is_active,sort_order,image_url,category,rarity,xp_reward
) values
  ('captures-5','Contributeur fiches I','Cinq fiches publiées et validées',null,'PERMANENT',
    '{"family":"entry-contribution","metric":"publishedEntries","threshold":5,"tier":1}'::jsonb,true,95,null,'ACHIEVEMENT','COMMON',0),
  ('captures-25','Contributeur fiches III','Vingt-cinq fiches publiées et validées',null,'PERMANENT',
    '{"family":"entry-contribution","metric":"publishedEntries","threshold":25,"tier":3}'::jsonb,true,105,null,'ACHIEVEMENT','RARE',0),
  ('captures-250','Contributeur fiches VI','Deux cent cinquante fiches publiées et validées',null,'PERMANENT',
    '{"family":"entry-contribution","metric":"publishedEntries","threshold":250,"tier":6}'::jsonb,true,125,null,'ACHIEVEMENT','LEGENDARY',0)
on conflict(slug) do update set
  name=excluded.name,
  description=excluded.description,
  criteria=excluded.criteria,
  category=excluded.category,
  rarity=excluded.rarity,
  is_active=true,
  sort_order=excluded.sort_order;

update public.badges set
  name = case slug
    when 'captures-10' then 'Contributeur fiches II'
    when 'captures-50' then 'Contributeur fiches IV'
    when 'captures-100' then 'Contributeur fiches V'
    else name
  end,
  description = case slug
    when 'captures-10' then 'Dix fiches publiées et validées'
    when 'captures-50' then 'Cinquante fiches publiées et validées'
    when 'captures-100' then 'Cent fiches publiées et validées'
    else description
  end,
  updated_at = now()
where slug in ('captures-10','captures-50','captures-100');

insert into public.user_badges(user_id,badge_id,is_active,source_type,metadata)
select counts.user_id,b.id,true,'ENTRY_MILESTONE',
  jsonb_build_object('automatic',true,'backfill',true,'family','entry-contribution')
from (
  select original_contributor_id user_id,count(*)::int total
  from public.entries
  where status='PUBLISHED' and deleted_at is null and not is_demo
  group by original_contributor_id
) counts
join public.badges b on b.slug in ('captures-5','captures-10','captures-25','captures-50','captures-100','captures-250')
where counts.total >= case b.slug
  when 'captures-5' then 5
  when 'captures-10' then 10
  when 'captures-25' then 25
  when 'captures-50' then 50
  when 'captures-100' then 100
  when 'captures-250' then 250
  else 2147483647
end
on conflict do nothing;

commit;
