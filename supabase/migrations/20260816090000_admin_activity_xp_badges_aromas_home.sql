begin;

-- Une session logique de navigateur peut contenir plusieurs périodes réelles
-- séparées par le délai d'inactivité. Une seule période reste active à la fois.
alter table public.user_sessions
  drop constraint if exists user_sessions_client_session_id_key;

update public.user_sessions
set duration_seconds=least(
  86400,
  greatest(0,extract(epoch from (coalesce(ended_at,last_activity_at)-started_at))::integer)
)
where duration_seconds is null or duration_seconds<0 or duration_seconds>86400;

alter table public.user_sessions
  drop constraint if exists user_sessions_duration_reasonable;
alter table public.user_sessions
  add constraint user_sessions_duration_reasonable check(
    duration_seconds is null or duration_seconds between 0 and 86400
  );

create unique index if not exists user_sessions_one_active_client_idx
  on public.user_sessions(user_id,client_session_id)
  where ended_at is null and client_session_id is not null;
create index if not exists user_sessions_client_started_idx
  on public.user_sessions(client_session_id,started_at desc);

create table if not exists public.experience_rules (
  key text primary key, label text not null, points integer not null,
  is_active boolean not null default true, description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.level_definitions (
  level integer primary key check(level>0), threshold integer not null unique check(threshold>=0),
  title text not null, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.experience_rules(key,label,points,description) values
  ('ENTRY_PUBLISHED','Fiche publiée',20,'Une fois quand une fiche devient publique.'),
  ('REVIEW_PUBLISHED','Avis publié',8,'Une fois quand un avis devient public.'),
  ('FIRST_ENTRY_BONUS','Première fiche publiée',25,'Bonus unique par utilisateur.'),
  ('FIRST_REVIEW_BONUS','Premier avis publié',10,'Bonus unique par utilisateur.'),
  ('CONTEST_PARTICIPATION','Participation à un concours',3,'Une fois par concours et utilisateur.'),
  ('CONTEST_WIN','Victoire de concours',25,'Une fois par concours et gagnant.')
on conflict(key) do nothing;

insert into public.level_definitions(level,threshold,title) values
  (1,0,'Novice'),(2,100,'Observateur'),(3,250,'Explorateur'),
  (4,450,'Chercheur'),(5,700,'Dresseur'),(6,1000,'Dresseur confirmé'),
  (7,1400,'Dresseur expert'),(8,1900,'Archiviste Pokédex'),
  (9,2500,'Expert Pokédex'),(10,3250,'Maître Dresseur'),
  (11,4150,'Conservateur'),(12,5250,'Maître Archiviste'),
  (13,6600,'Érudit Pokédex'),(14,8250,'Gardien des Archives'),
  (15,10250,'Légende PokéTerps') on conflict(level) do nothing;

create or replace function public.experience_level_for_points(p_points bigint)
returns integer language plpgsql stable set search_path='' as $$
declare v_points bigint:=greatest(coalesce(p_points,0),0); v_level integer;
  v_threshold bigint; v_increment bigint;
begin
  select d.level,d.threshold into v_level,v_threshold from public.level_definitions d
  where d.is_active and d.threshold<=v_points order by d.threshold desc limit 1;
  v_level:=coalesce(v_level,1); v_threshold:=coalesce(v_threshold,0);
  if v_level>=15 then
    v_increment:=2000+greatest(0,v_level-15)*300;
    loop
      v_increment:=v_increment+300;
      exit when v_points<v_threshold+v_increment;
      v_threshold:=v_threshold+v_increment; v_level:=v_level+1;
    end loop;
  end if;
  return v_level;
end $$;

create or replace function public.apply_experience_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_total bigint;
begin
  update public.users set experience_points=greatest(experience_points+new.points,0),updated_at=now()
  where id=new.user_id returning experience_points into v_total;
  update public.users set level=public.experience_level_for_points(v_total) where id=new.user_id;
  return new;
end $$;
drop trigger if exists apply_experience_event on public.user_experience_events;
create trigger apply_experience_event after insert on public.user_experience_events
  for each row execute function public.apply_experience_event();

alter table public.experience_rules enable row level security;
alter table public.level_definitions enable row level security;
drop policy if exists public_experience_rules_read on public.experience_rules;
create policy public_experience_rules_read on public.experience_rules for select to anon,authenticated using(is_active);
drop policy if exists public_level_definitions_read on public.level_definitions;
create policy public_level_definitions_read on public.level_definitions for select to anon,authenticated using(is_active);
revoke all on public.experience_rules,public.level_definitions from public,anon,authenticated;
grant select on public.experience_rules,public.level_definitions to anon,authenticated;
grant all on public.experience_rules,public.level_definitions to service_role;
revoke execute on function public.experience_level_for_points(bigint) from public,anon,authenticated;
grant execute on function public.experience_level_for_points(bigint) to service_role;
revoke execute on function public.apply_experience_event() from public,anon,authenticated;
grant execute on function public.apply_experience_event() to service_role;

alter table public.badges add column if not exists image_url text;
alter table public.badges add column if not exists category text not null default 'ACHIEVEMENT';
alter table public.badges add column if not exists rarity text not null default 'COMMON';
alter table public.badges add column if not exists xp_reward integer not null default 0;
alter table public.user_badges add column if not exists source_type text;
alter table public.user_badges add column if not exists source_id uuid;
do $$ begin
  alter table public.badges add constraint badges_category_valid
    check(category in ('LEVEL','ROLE','ACHIEVEMENT','PARTNER','CONTEST'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.badges add constraint badges_rarity_valid
    check(rarity in ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.badges add constraint badges_xp_reward_nonnegative check(xp_reward>=0);
exception when duplicate_object then null; end $$;

insert into public.badges(slug,name,description,icon,kind,criteria,is_active,sort_order,image_url,category,rarity,xp_reward) values
  ('level-1','Novice','Premier niveau de progression PokéTerps',null,'PERMANENT','{"minimumLevel":1}',true,10,'/badges/level-1.png','LEVEL','COMMON',0),
  ('level-5','Dresseur','Palier de Dresseur atteint',null,'PERMANENT','{"minimumLevel":5}',true,20,'/badges/level-5.png','LEVEL','UNCOMMON',0),
  ('level-10','Maître Dresseur','Dix niveaux de contributions vérifiées',null,'PERMANENT','{"minimumLevel":10}',true,30,'/badges/level-10.png','LEVEL','EPIC',0),
  ('level-15','Légende PokéTerps','Palier légendaire des archives',null,'PERMANENT','{"minimumLevel":15}',true,40,'/badges/level-15.png','LEVEL','LEGENDARY',0),
  ('partner','Partenaire','Partenaire reconnu de la communauté',null,'ACTIVE','{}',true,50,'/badges/historic-contributor.png','PARTNER','RARE',0),
  ('contest-winner','Gagnant concours','Victoire validée dans un concours PokéTerps',null,'HISTORICAL','{}',true,60,'/badges/contest-winner.png','CONTEST','EPIC',0),
  ('top-trainer','Top Dresseur','Présence au sommet d’un classement',null,'ACTIVE','{}',true,70,'/badges/top-trainer.png','ACHIEVEMENT','EPIC',0),
  ('historic-contributor','Contributeur historique','Contribution durable aux archives',null,'HISTORICAL','{}',true,80,'/badges/historic-contributor.png','ACHIEVEMENT','LEGENDARY',0),
  ('first-review','Premier avis','Premier avis validé et publié',null,'PERMANENT','{"publishedReviews":1}',true,90,'/badges/level-1.png','ACHIEVEMENT','COMMON',0),
  ('captures-10','10 captures','Dix fiches publiées',null,'PERMANENT','{"publishedEntries":10}',true,100,'/badges/level-5.png','ACHIEVEMENT','UNCOMMON',5),
  ('captures-50','50 captures','Cinquante fiches publiées',null,'PERMANENT','{"publishedEntries":50}',true,110,'/badges/level-10.png','ACHIEVEMENT','RARE',15),
  ('captures-100','100 captures','Cent fiches publiées',null,'PERMANENT','{"publishedEntries":100}',true,120,'/badges/level-15.png','ACHIEVEMENT','LEGENDARY',30)
on conflict(slug) do update set name=excluded.name,description=excluded.description,
  image_url=excluded.image_url,category=excluded.category,rarity=excluded.rarity,
  xp_reward=excluded.xp_reward,criteria=excluded.criteria,is_active=true,sort_order=excluded.sort_order;

update public.badges set image_url='/badges/role-owner.png',category='ROLE',rarity='LEGENDARY'
  where slug='role-owner';
update public.badges set image_url='/badges/role-admin.png',category='ROLE',rarity='EPIC'
  where slug='role-admin';
update public.badges set image_url='/badges/role-moderator.png',category='ROLE',rarity='RARE'
  where slug='role-moderator';

insert into public.user_experience_events(user_id,points,reason,source_type,source_id,idempotency_key,metadata)
select e.original_contributor_id,r.points,'Fiche « '||e.name||' » publiée','ENTRY',e.id,
  'ENTRY_PUBLISHED:'||e.id,jsonb_build_object('ruleKey','ENTRY_PUBLISHED','backfill',true)
from public.entries e join public.experience_rules r on r.key='ENTRY_PUBLISHED' and r.is_active
where e.status='PUBLISHED' and e.deleted_at is null and not e.is_demo
on conflict(idempotency_key) do nothing;
insert into public.user_experience_events(user_id,points,reason,source_type,source_id,idempotency_key,metadata)
select distinct on(e.original_contributor_id) e.original_contributor_id,r.points,'Première fiche publiée','USER',
  e.original_contributor_id,'FIRST_ENTRY_BONUS:'||e.original_contributor_id,
  jsonb_build_object('ruleKey','FIRST_ENTRY_BONUS','backfill',true)
from public.entries e join public.experience_rules r on r.key='FIRST_ENTRY_BONUS' and r.is_active
where e.status='PUBLISHED' and e.deleted_at is null and not e.is_demo
order by e.original_contributor_id,e.published_at,e.id on conflict(idempotency_key) do nothing;
insert into public.user_experience_events(user_id,points,reason,source_type,source_id,idempotency_key,metadata)
select v.user_id,r.points,'Avis publié','REVIEW',v.id,'REVIEW_PUBLISHED:'||v.id,
  jsonb_build_object('ruleKey','REVIEW_PUBLISHED','backfill',true)
from public.reviews v join public.experience_rules r on r.key='REVIEW_PUBLISHED' and r.is_active
where v.status='PUBLISHED' and v.deleted_at is null on conflict(idempotency_key) do nothing;
insert into public.user_experience_events(user_id,points,reason,source_type,source_id,idempotency_key,metadata)
select distinct on(v.user_id) v.user_id,r.points,'Premier avis publié','USER',v.user_id,
  'FIRST_REVIEW_BONUS:'||v.user_id,jsonb_build_object('ruleKey','FIRST_REVIEW_BONUS','backfill',true)
from public.reviews v join public.experience_rules r on r.key='FIRST_REVIEW_BONUS' and r.is_active
where v.status='PUBLISHED' and v.deleted_at is null order by v.user_id,v.published_at,v.id
on conflict(idempotency_key) do nothing;
insert into public.user_experience_events(user_id,points,reason,source_type,source_id,idempotency_key,metadata)
select p.user_id,r.points,'Participation à un concours','CONTEST',p.contest_id,
  'CONTEST_PARTICIPATION:'||p.contest_id||':'||p.user_id,
  jsonb_build_object('ruleKey','CONTEST_PARTICIPATION','backfill',true)
from public.contest_participations p join public.experience_rules r
  on r.key='CONTEST_PARTICIPATION' and r.is_active
where p.status in ('PENDING_REVIEW','APPROVED') on conflict(idempotency_key) do nothing;
insert into public.user_experience_events(user_id,points,reason,source_type,source_id,idempotency_key,metadata)
select p.user_id,r.points,'Victoire de concours','CONTEST',w.contest_id,
  'CONTEST_WIN:'||w.contest_id||':'||p.user_id,
  jsonb_build_object('ruleKey','CONTEST_WIN','backfill',true,'winnerId',w.id)
from public.contest_winners w join public.contest_participations p on p.id=w.participation_id
join public.experience_rules r on r.key='CONTEST_WIN' and r.is_active
on conflict(idempotency_key) do nothing;

insert into public.user_badges(user_id,badge_id,is_active,source_type,metadata)
select u.id,b.id,true,'LEVEL',jsonb_build_object('automatic',true,'backfill',true)
from public.users u join public.badges b on b.slug in ('level-1','level-5','level-10','level-15')
where (b.slug='level-1' and u.level>=1) or (b.slug='level-5' and u.level>=5)
   or (b.slug='level-10' and u.level>=10) or (b.slug='level-15' and u.level>=15)
on conflict do nothing;
insert into public.user_badges(user_id,badge_id,is_active,source_type,metadata)
select v.user_id,b.id,true,'REVIEW',jsonb_build_object('automatic',true,'backfill',true)
from (select distinct user_id from public.reviews where status='PUBLISHED' and deleted_at is null) v
join public.badges b on b.slug='first-review' on conflict do nothing;
insert into public.user_badges(user_id,badge_id,is_active,source_type,metadata)
select counts.user_id,b.id,true,'ENTRY_MILESTONE',jsonb_build_object('automatic',true,'backfill',true)
from (select original_contributor_id user_id,count(*)::int total from public.entries
  where status='PUBLISHED' and deleted_at is null and not is_demo group by original_contributor_id) counts
join public.badges b on (b.slug='captures-10' and counts.total>=10)
  or (b.slug='captures-50' and counts.total>=50) or (b.slug='captures-100' and counts.total>=100)
on conflict do nothing;
insert into public.user_badges(user_id,badge_id,is_active,source_type,source_id,metadata)
select p.user_id,b.id,true,'CONTEST',w.contest_id,jsonb_build_object('automatic',true,'backfill',true)
from public.contest_winners w join public.contest_participations p on p.id=w.participation_id
join public.badges b on b.slug='contest-winner' on conflict do nothing;

-- Taxonomie aromatique structurée : une note principale et plusieurs secondaires.
do $$ begin
  create type public.aroma_importance as enum ('PRIMARY','SECONDARY');
exception when duplicate_object then null; end $$;

create table if not exists public.aroma_families (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aromas (
  id uuid primary key default extensions.gen_random_uuid(),
  family_id uuid not null references public.aroma_families(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  synonyms text[] not null default '{}',
  translations jsonb not null default '{}'::jsonb check(jsonb_typeof(translations)='object'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entry_aromas (
  entry_id uuid not null references public.entries(id) on delete cascade,
  aroma_id uuid not null references public.aromas(id) on delete restrict,
  importance public.aroma_importance not null,
  custom_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(entry_id,aroma_id),
  constraint entry_aromas_custom_label_length check(
    custom_label is null or char_length(btrim(custom_label)) between 2 and 120
  )
);

create index if not exists aroma_families_active_sort_idx
  on public.aroma_families(is_active,sort_order);
create index if not exists aromas_family_active_sort_idx
  on public.aromas(family_id,is_active,sort_order);
create unique index if not exists entry_aromas_one_primary_idx
  on public.entry_aromas(entry_id) where importance='PRIMARY';
create index if not exists entry_aromas_aroma_entry_idx
  on public.entry_aromas(aroma_id,entry_id);

insert into public.aroma_families(slug,name,sort_order) values
  ('fruite','Fruité',10),('agrumes','Agrumes',20),('tropical','Tropical / exotique',30),
  ('sucre-dessert','Sucré / dessert',40),('floral','Floral',50),('terreux','Terreux',60),
  ('boise-resineux','Boisé / résineux',70),('herbace-vegetal','Herbacé / végétal',80),
  ('epice','Épicé',90),('gas-carburant','Gas / carburant',100),
  ('skunk-funky','Skunk / funky',110),('chimique','Chimique',120),
  ('acidule-sour','Acidulé / Sour',130),('gourmand-sale','Gourmand / salé',140),
  ('autre','Autre',150)
on conflict(slug) do update set name=excluded.name,sort_order=excluded.sort_order,is_active=true;

with aroma_seed(family_slug,slug,name,sort_order,synonyms) as (values
  ('fruite','fruits-rouges','Fruits rouges',10,array['baies']::text[]),
  ('fruite','fraise','Fraise',20,array[]::text[]),('fruite','framboise','Framboise',30,array[]::text[]),
  ('fruite','myrtille','Myrtille',40,array[]::text[]),('fruite','mure','Mûre',50,array[]::text[]),
  ('fruite','cerise','Cerise',60,array[]::text[]),('fruite','raisin','Raisin',70,array[]::text[]),
  ('fruite','pomme','Pomme',80,array[]::text[]),('fruite','poire','Poire',90,array[]::text[]),
  ('fruite','peche','Pêche',100,array[]::text[]),('fruite','abricot','Abricot',110,array[]::text[]),
  ('fruite','prune','Prune',120,array[]::text[]),('fruite','banane','Banane',130,array[]::text[]),
  ('fruite','melon','Melon',140,array[]::text[]),('fruite','pasteque','Pastèque',150,array[]::text[]),
  ('agrumes','citron','Citron',10,array['lemon']::text[]),('agrumes','citron-vert','Citron vert',20,array['lime']::text[]),
  ('agrumes','orange','Orange',30,array[]::text[]),('agrumes','mandarine','Mandarine',40,array[]::text[]),
  ('agrumes','pamplemousse','Pamplemousse',50,array['grapefruit']::text[]),
  ('agrumes','bergamote','Bergamote',60,array[]::text[]),
  ('tropical','mangue','Mangue',10,array[]::text[]),('tropical','ananas','Ananas',20,array[]::text[]),
  ('tropical','fruit-passion','Fruit de la passion',30,array['passion']::text[]),
  ('tropical','goyave','Goyave',40,array[]::text[]),('tropical','papaye','Papaye',50,array[]::text[]),
  ('tropical','noix-coco','Noix de coco',60,array['coco']::text[]),
  ('tropical','exotique-tropical','Exotique / Tropical général',70,array['tropical']::text[]),
  ('sucre-dessert','sucre','Sucré',10,array['sweet']::text[]),('sucre-dessert','sucre-cristal','Sucre',20,array[]::text[]),
  ('sucre-dessert','bonbon','Bonbon',30,array['candy']::text[]),('sucre-dessert','caramel','Caramel',40,array[]::text[]),
  ('sucre-dessert','vanille','Vanille',50,array['vanilla']::text[]),('sucre-dessert','miel','Miel',60,array['honey']::text[]),
  ('sucre-dessert','creme','Crème',70,array['cream']::text[]),('sucre-dessert','biscuit','Biscuit',80,array[]::text[]),
  ('sucre-dessert','gateau','Gâteau',90,array['cake']::text[]),('sucre-dessert','chocolat','Chocolat',100,array[]::text[]),
  ('sucre-dessert','patisserie','Pâtisserie',110,array['pastry']::text[]),
  ('floral','floral','Floral',10,array[]::text[]),('floral','rose','Rose',20,array[]::text[]),
  ('floral','lavande','Lavande',30,array['lavender']::text[]),('floral','violette','Violette',40,array[]::text[]),
  ('floral','fleur-blanche','Fleur blanche',50,array[]::text[]),
  ('terreux','terre','Terre',10,array['earth']::text[]),('terreux','terre-humide','Terre humide',20,array[]::text[]),
  ('terreux','sous-bois','Sous-bois',30,array[]::text[]),('terreux','mousse','Mousse',40,array[]::text[]),
  ('terreux','humus','Humus',50,array[]::text[]),
  ('boise-resineux','bois','Bois',10,array['wood']::text[]),('boise-resineux','cedre','Cèdre',20,array['cedar']::text[]),
  ('boise-resineux','pin','Pin',30,array['pine']::text[]),('boise-resineux','resineux','Résineux',40,array[]::text[]),
  ('boise-resineux','sapin','Sapin',50,array['fir']::text[]),
  ('herbace-vegetal','herbes','Herbes',10,array['herbal']::text[]),
  ('herbace-vegetal','herbe-fraiche','Herbe fraîche',20,array['fresh grass']::text[]),
  ('herbace-vegetal','menthe','Menthe',30,array['mint']::text[]),
  ('herbace-vegetal','eucalyptus','Eucalyptus',40,array[]::text[]),
  ('herbace-vegetal','the','Thé',50,array['tea']::text[]),('herbace-vegetal','houblon','Houblon',60,array['hops']::text[]),
  ('herbace-vegetal','feuilles','Feuilles',70,array['leaves']::text[]),
  ('herbace-vegetal','vegetal','Végétal',80,array['green']::text[]),
  ('epice','poivre','Poivre',10,array['pepper']::text[]),('epice','clou-girofle','Clou de girofle',20,array['clove']::text[]),
  ('epice','cannelle','Cannelle',30,array['cinnamon']::text[]),('epice','epices','Épices',40,array['spicy']::text[]),
  ('epice','anis','Anis',50,array[]::text[]),
  ('gas-carburant','gas','Gas',10,array['gassy']::text[]),('gas-carburant','diesel','Diesel',20,array[]::text[]),
  ('gas-carburant','essence','Essence',30,array['gasoline']::text[]),('gas-carburant','fuel','Fuel',40,array['carburant']::text[]),
  ('gas-carburant','kerosene','Kérosène',50,array[]::text[]),
  ('skunk-funky','skunk','Skunk',10,array[]::text[]),('skunk-funky','funky','Funky',20,array[]::text[]),
  ('skunk-funky','musque','Musqué',30,array['musky']::text[]),('skunk-funky','animal','Animal',40,array[]::text[]),
  ('skunk-funky','fermente','Fermenté',50,array['fermented']::text[]),
  ('chimique','chimique','Chimique',10,array['chemical']::text[]),('chimique','solvant','Solvant',20,array['solvent']::text[]),
  ('chimique','ammoniaque','Ammoniaque',30,array['ammonia']::text[]),
  ('chimique','produit-nettoyant','Produit nettoyant',40,array['cleaner']::text[]),
  ('acidule-sour','sour','Sour',10,array[]::text[]),('acidule-sour','aigre','Aigre',20,array[]::text[]),
  ('acidule-sour','acidule','Acidulé',30,array['tangy']::text[]),
  ('acidule-sour','fermentation','Fermentation',40,array[]::text[]),
  ('acidule-sour','vinaigre-leger','Vinaigré léger',50,array['vinegar']::text[]),
  ('gourmand-sale','ail','Ail',10,array['garlic']::text[]),('gourmand-sale','oignon','Oignon',20,array['onion']::text[]),
  ('gourmand-sale','fromage','Fromage',30,array['cheese']::text[]),('gourmand-sale','noix','Noix',40,array['nutty']::text[]),
  ('gourmand-sale','cafe','Café',50,array['coffee']::text[]),('gourmand-sale','cacao','Cacao',60,array[]::text[]),
  ('gourmand-sale','toaste','Toasté',70,array['toasted']::text[]),('gourmand-sale','beurre','Beurré',80,array['buttery']::text[]),
  ('autre','autre','Autre',10,array['other']::text[])
)
insert into public.aromas(family_id,slug,name,sort_order,synonyms)
select f.id,s.slug,s.name,s.sort_order,s.synonyms
from aroma_seed s join public.aroma_families f on f.slug=s.family_slug
on conflict(slug) do update set family_id=excluded.family_id,name=excluded.name,
  sort_order=excluded.sort_order,synonyms=excluded.synonyms,is_active=true,updated_at=now();

alter table public.aroma_families enable row level security;
alter table public.aromas enable row level security;
alter table public.entry_aromas enable row level security;
drop policy if exists public_aroma_families_read on public.aroma_families;
create policy public_aroma_families_read on public.aroma_families for select to anon,authenticated
  using(is_active);
drop policy if exists public_aromas_read on public.aromas;
create policy public_aromas_read on public.aromas for select to anon,authenticated using(is_active);
drop policy if exists public_entry_aromas_read on public.entry_aromas;
create policy public_entry_aromas_read on public.entry_aromas for select to anon,authenticated
  using(exists(select 1 from public.entries e where e.id=entry_id
    and e.status='PUBLISHED' and e.deleted_at is null));

revoke all on public.aroma_families,public.aromas,public.entry_aromas from public,anon,authenticated;
grant select on public.aroma_families,public.aromas,public.entry_aromas to anon,authenticated;
grant all on public.aroma_families,public.aromas,public.entry_aromas to service_role;

commit;
