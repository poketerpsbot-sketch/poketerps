-- Remove the medical demo taxonomy from the public catalogue and add
-- category-specific measurement fields. Safe to run more than once.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

-- Keep the old records recoverable while making the medical category and its
-- taxonomy impossible to select from public or contribution screens.
update public.entries e
set status = 'DELETED'::public.entry_status,
    deleted_at = coalesce(e.deleted_at, now()),
    archived_at = coalesce(e.archived_at, now()),
    updated_at = now()
where e.is_demo
  and e.seed_key in ('demo.medicinal.oil', 'demo.medicinal.capsules')
  and (e.status <> 'DELETED'::public.entry_status or e.deleted_at is null);

update public.dynamic_field_definitions d
set is_visible = false,
    deleted_at = coalesce(d.deleted_at, now()),
    updated_at = now()
from public.categories c
where c.id = d.category_id
  and c.slug = 'medicinal'
  and (d.is_visible or d.deleted_at is null);

update public.subcategories s
set is_visible = false,
    deleted_at = coalesce(s.deleted_at, now()),
    updated_at = now()
from public.categories c
where c.id = s.category_id
  and c.slug = 'medicinal'
  and (s.is_visible or s.deleted_at is null);

update public.categories
set is_visible = false,
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now()
where slug = 'medicinal'
  and (is_visible or deleted_at is null);

create temporary table if not exists pokedex_expected_measurement_fields (
  category_slug text not null,
  field_key text not null,
  label text not null,
  description text not null,
  unit text not null,
  sort_order integer not null,
  max_value numeric not null,
  step_value numeric not null,
  primary key (category_slug, field_key)
) on commit drop;

truncate table pokedex_expected_measurement_fields;

insert into pokedex_expected_measurement_fields(
  category_slug,field_key,label,description,unit,sort_order,max_value,step_value
) values
  ('fleur','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage.','g',150,100000,0.01),
  ('fleur','declared_thc_mg_g','THC déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',160,1000,0.1),
  ('fleur','declared_cbd_mg_g','CBD déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',170,1000,0.1),
  ('fleur','declared_thc_percent','THC déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',180,100,0.1),
  ('fleur','declared_cbd_percent','CBD déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',190,100,0.1),

  ('pre-roll','declared_weight','Poids net total déclaré','Poids net total indiqué sur l’emballage.','g',60,100000,0.01),
  ('pre-roll','declared_unit_count','Nombre de pré-rolls','Nombre d’unités indiqué sur l’emballage.','unité(s)',70,10000,1),
  ('pre-roll','declared_unit_weight','Poids déclaré par pré-roll','Poids indiqué pour une unité.','g',80,1000,0.01),
  ('pre-roll','declared_thc_per_unit','THC déclaré par pré-roll','Quantité indiquée pour une unité.','mg/unité',90,100000,0.1),
  ('pre-roll','declared_cbd_per_unit','CBD déclaré par pré-roll','Quantité indiquée pour une unité.','mg/unité',100,100000,0.1),

  ('hash','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage.','g',70,100000,0.01),
  ('hash','declared_thc_mg_g','THC déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',80,1000,0.1),
  ('hash','declared_cbd_mg_g','CBD déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',90,1000,0.1),
  ('hash','declared_thc_percent','THC déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',100,100,0.1),
  ('hash','declared_cbd_percent','CBD déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',110,100,0.1),

  ('rosin','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage.','g',60,100000,0.01),
  ('rosin','declared_thc_mg_g','THC déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',70,1000,0.1),
  ('rosin','declared_cbd_mg_g','CBD déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',80,1000,0.1),
  ('rosin','declared_thc_percent','THC déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',90,100,0.1),
  ('rosin','declared_cbd_percent','CBD déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',100,100,0.1),

  ('extractions-solvants','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage.','g',70,100000,0.01),
  ('extractions-solvants','declared_thc_mg_g','THC déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',80,1000,0.1),
  ('extractions-solvants','declared_cbd_mg_g','CBD déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',90,1000,0.1),
  ('extractions-solvants','declared_thc_percent','THC déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',100,100,0.1),
  ('extractions-solvants','declared_cbd_percent','CBD déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',110,100,0.1),

  ('vape','declared_capacity','Volume déclaré','Volume indiqué sur l’emballage.','mL',60,100000,0.01),
  ('vape','declared_fill_weight','Poids de remplissage déclaré','Poids de remplissage indiqué sur l’emballage.','g',70,100000,0.01),
  ('vape','declared_unit_count','Nombre de dispositifs','Nombre d’unités indiqué sur l’emballage.','unité(s)',80,10000,1),
  ('vape','declared_thc_mg_ml','THC déclaré','Concentration indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',90,10000,0.1),
  ('vape','declared_cbd_mg_ml','CBD déclaré','Concentration indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',100,10000,0.1),

  ('edibles','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage pour un produit solide.','g',60,100000,0.01),
  ('edibles','declared_volume','Volume net déclaré','Volume net indiqué sur l’emballage pour une boisson.','mL',70,100000,0.01),
  ('edibles','servings','Nombre d’unités','Nombre d’unités indiqué sur l’emballage.','unité(s)',80,10000,1),
  ('edibles','declared_thc_per_unit','THC déclaré par unité','Quantité indiquée pour une unité.','mg/unité',90,100000,0.1),
  ('edibles','declared_cbd_per_unit','CBD déclaré par unité','Quantité indiquée pour une unité.','mg/unité',100,100000,0.1),
  ('edibles','declared_thc_per_package','THC déclaré par emballage','Quantité totale indiquée pour l’emballage.','mg/emballage',110,1000000,0.1),
  ('edibles','declared_cbd_per_package','CBD déclaré par emballage','Quantité totale indiquée pour l’emballage.','mg/emballage',120,1000000,0.1),

  ('topiques','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage pour un produit solide.','g',40,100000,0.01),
  ('topiques','declared_volume','Volume net déclaré','Volume net indiqué sur l’emballage pour un produit liquide.','mL',50,100000,0.01),
  ('topiques','declared_thc_mg_g','THC déclaré','Concentration massique indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',60,1000,0.1),
  ('topiques','declared_cbd_mg_g','CBD déclaré','Concentration massique indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',70,1000,0.1),
  ('topiques','declared_thc_mg_ml','THC déclaré','Concentration volumique indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',80,10000,0.1),
  ('topiques','declared_cbd_mg_ml','CBD déclaré','Concentration volumique indiquée sur l’étiquette ou un rapport d’analyse.','mg/mL',90,10000,0.1),

  ('concentres-sans-solvant','declared_net_weight','Poids net déclaré','Poids net indiqué sur l’emballage.','g',50,100000,0.01),
  ('concentres-sans-solvant','declared_thc_mg_g','THC déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',60,1000,0.1),
  ('concentres-sans-solvant','declared_cbd_mg_g','CBD déclaré','Teneur par gramme indiquée sur l’étiquette ou un rapport d’analyse.','mg/g',70,1000,0.1),
  ('concentres-sans-solvant','declared_thc_percent','THC déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',80,100,0.1),
  ('concentres-sans-solvant','declared_cbd_percent','CBD déclaré','Pourcentage indiqué sur l’étiquette ou un rapport d’analyse.','%',90,100,0.1);

insert into public.dynamic_field_definitions(
  category_id,key,label,description,field_type,unit,validation_rules,
  is_required,is_filterable,is_searchable,is_visible,sort_order,deleted_at
)
select c.id, expected.field_key, expected.label, expected.description,
  'NUMBER'::public.dynamic_field_type, expected.unit,
  jsonb_build_object('min',0,'max',expected.max_value,'step',expected.step_value),
  false,true,false,true,expected.sort_order,null
from pokedex_expected_measurement_fields expected
join public.categories c on c.slug = expected.category_slug
on conflict do nothing;

update public.dynamic_field_definitions d
set label = expected.label,
    description = expected.description,
    field_type = 'NUMBER'::public.dynamic_field_type,
    unit = expected.unit,
    validation_rules = jsonb_build_object(
      'min',0,'max',expected.max_value,'step',expected.step_value
    ),
    is_filterable = true,
    is_visible = true,
    sort_order = expected.sort_order,
    deleted_at = null,
    updated_at = now()
from pokedex_expected_measurement_fields expected
join public.categories c on c.slug = expected.category_slug
where d.category_id = c.id
  and d.subcategory_id is null
  and d.key = expected.field_key;

-- SI spelling is case-sensitive: millilitre is mL, never ml.
update public.dynamic_field_definitions
set unit = 'mL', updated_at = now()
where lower(unit) = 'ml' and unit <> 'mL';

-- Fail the migration rather than silently shipping a partial taxonomy.
do $$
declare
  missing_count integer;
begin
  if exists (
    select 1 from public.categories
    where slug = 'medicinal' and (is_visible or deleted_at is null)
  ) then
    raise exception 'The medicinal category was not soft-deleted';
  end if;

  if exists (
    select 1 from public.entries
    where seed_key in ('demo.medicinal.oil','demo.medicinal.capsules')
      and (status <> 'DELETED'::public.entry_status or deleted_at is null)
  ) then
    raise exception 'A medicinal demo entry is still public';
  end if;

  select count(*) into missing_count
  from pokedex_expected_measurement_fields expected
  left join public.categories c on c.slug = expected.category_slug
  left join public.dynamic_field_definitions d
    on d.category_id = c.id
   and d.subcategory_id is null
   and d.key = expected.field_key
   and d.field_type = 'NUMBER'::public.dynamic_field_type
   and d.unit = expected.unit
   and d.is_visible
   and d.deleted_at is null
  where d.id is null;

  if missing_count <> 0 then
    raise exception 'Measurement taxonomy is incomplete: % fields missing or invalid', missing_count;
  end if;

  if exists (select 1 from public.dynamic_field_definitions where unit = 'ml') then
    raise exception 'Invalid ml unit remains; expected mL';
  end if;
end $$;

commit;
