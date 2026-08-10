-- Enrich the 20 editorial demo entries without recreating demos that an operator removed.
-- The block is intentionally idempotent and only targets rows still marked is_demo=true.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '0';
set local search_path = public, extensions, pg_temp;

alter table public.entry_images
  add column if not exists source_url text,
  add column if not exists credit text,
  add column if not exists license_name text,
  add column if not exists license_url text;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname='entry_images_attribution_consistency'
      and conrelid='public.entry_images'::regclass
  ) then
    alter table public.entry_images
      add constraint entry_images_attribution_consistency check (
        (source_url is null and credit is null and license_name is null and license_url is null)
        or (
          source_url is not null and char_length(source_url) between 9 and 2048
            and source_url ~ '^https://[^[:space:]]+$'
          and credit is not null and char_length(btrim(credit)) between 1 and 500
          and license_name is not null and char_length(btrim(license_name)) between 1 and 120
          and license_url is not null and char_length(license_url) between 9 and 2048
            and license_url ~ '^https://[^[:space:]]+$'
        )
      );
  end if;
end $$;

do $$
declare
  content record;
  field_item record;
begin
  for content in
    select *
    from jsonb_to_recordset($demo$
    [
      {
        "seed_key": "demo.flower.indoor",
        "short_description": "Fleur indoor fictive aux tons verts et violets, à la structure compacte et au profil aromatique boisé-agrumes.",
        "full_description": "Cette fiche de démonstration illustre la documentation éditoriale d’une fleur classée indoor. Les calices serrés, les pistils ambrés et la couverture de trichomes décrits ici composent un exemple visuel fictif.\n\nAucun cultivar, producteur, lot ou résultat analytique réel n’est associé à cette entrée. Les descripteurs servent uniquement à montrer le niveau de détail attendu dans le catalogue.",
        "declared_variety": "Profil fictif agrumes et pin",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Culture indoor — classification descriptive",
        "texture": "Structure compacte et surface résineuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif agrumes et pin", "display": "Profil fictif agrumes et pin"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "cultivation": {"value": "indoor", "display": "Indoor", "option": "indoor"},
          "appearance": {"value": "Tons verts et violets, pistils ambrés et trichomes visibles — description illustrative.", "display": "Tons verts et violets, pistils ambrés et trichomes visibles — description illustrative."},
          "density": {"value": "dense", "display": "Dense — appréciation illustrative", "option": "dense"},
          "perceived_humidity": {"value": "balanced", "display": "Équilibrée — appréciation illustrative", "option": "balanced"}
        }
      },
      {
        "seed_key": "demo.flower.outdoor",
        "short_description": "Fleur outdoor fictive à la silhouette aérée, aux nuances vert clair et au profil floral-terreux.",
        "full_description": "Cette entrée présente un exemple de fleur classée outdoor, avec une structure ouverte, des feuilles fines et des pistils cuivrés décrits à titre illustratif. Elle montre comment séparer observations visuelles et informations déclarées.\n\nL’origine géographique, la variété, le producteur et la composition ne correspondent à aucun produit réel. La fiche demeure un contenu éditorial fictif destiné à étoffer la navigation.",
        "declared_variety": "Profil fictif floral et terreux",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Culture outdoor — classification descriptive",
        "texture": "Structure aérée et souple — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif floral et terreux", "display": "Profil fictif floral et terreux"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "cultivation": {"value": "outdoor", "display": "Outdoor", "option": "outdoor"},
          "appearance": {"value": "Structure ouverte, vert clair et pistils cuivrés — description illustrative.", "display": "Structure ouverte, vert clair et pistils cuivrés — description illustrative."},
          "density": {"value": "airy", "display": "Aérée — appréciation illustrative", "option": "airy"},
          "perceived_humidity": {"value": "balanced", "display": "Équilibrée — appréciation illustrative", "option": "balanced"}
        }
      },
      {
        "seed_key": "demo.pre-roll.joint",
        "short_description": "Pré-roll fictif au format joint, de forme cylindrique régulière et présenté comme exemple de catalogue.",
        "full_description": "Cette fiche illustre un pré-roll classé au format joint. La forme, le papier clair et le poids déclaré sont des données fictives choisies pour démontrer les champs structurés de la catégorie.\n\nAucun contenu réel, fabricant ou lot n’est représenté. L’entrée ne contient ni recommandation d’usage ni information commerciale.",
        "declared_variety": "Assemblage floral fictif",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Pré-roll joint — classification descriptive",
        "texture": "Papier clair et forme cylindrique — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage floral fictif", "display": "Assemblage floral fictif"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "format": {"value": "joint", "display": "Joint", "option": "joint"},
          "declared_weight": {"value": 0.5, "display": "0,5 g — valeur fictive"},
          "infused": {"value": false, "display": "Non — valeur fictive"}
        }
      },
      {
        "seed_key": "demo.pre-roll.cone",
        "short_description": "Pré-roll fictif au format cone, à la silhouette conique nette et aux données déclarées purement illustratives.",
        "full_description": "Cette entrée montre la variante cone dans la taxonomie des pré-rolls. Sa forme évasée, son papier neutre et son poids déclaré constituent uniquement un jeu de données de démonstration.\n\nAucun contenu, producteur ou conditionnement réel n’est associé à la fiche. Elle ne présente ni mode d’emploi ni offre commerciale.",
        "declared_variety": "Assemblage floral fictif",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Pré-roll cone — classification descriptive",
        "texture": "Papier neutre et forme conique — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage floral fictif", "display": "Assemblage floral fictif"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "format": {"value": "cone", "display": "Cone", "option": "cone"},
          "declared_weight": {"value": 0.7, "display": "0,7 g — valeur fictive"},
          "infused": {"value": false, "display": "Non — valeur fictive"}
        }
      },
      {
        "seed_key": "demo.hash.dry-sift",
        "short_description": "Dry Sift fictif à l’aspect sableux doré, documenté avec des descripteurs visuels non analytiques.",
        "full_description": "Cette fiche de démonstration représente la sous-catégorie Dry Sift par une texture fine, friable et légèrement dorée. Les observations sont volontairement limitées à l’apparence et au classement éditorial.\n\nLa variété, le producteur et le niveau de qualité sont fictifs ou non attribués. Aucun protocole, rendement ou résultat de laboratoire n’est fourni.",
        "declared_variety": "Assemblage fictif à dominante terreuse",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Dry Sift — classification descriptive",
        "texture": "Sableuse et friable — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage fictif à dominante terreuse", "display": "Assemblage fictif à dominante terreuse"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "texture": {"value": "sandy", "display": "Sableuse — appréciation illustrative", "option": "sandy"},
          "aromas": {"value": ["terreux", "boisé", "épicé"], "display": "Terreux, boisé, épicé — descripteurs fictifs"}
        }
      },
      {
        "seed_key": "demo.hash.bubble-hash",
        "short_description": "Bubble Hash fictif à l’aspect résineux brun doré, présenté comme repère visuel de taxonomie.",
        "full_description": "Cette entrée illustre la sous-catégorie Bubble Hash avec une matière granuleuse qui paraît s’agglomérer légèrement. La couleur et la texture sont des observations fictives destinées à remplir une fiche complète.\n\nAucun lot, producteur, grade ou analyse réelle n’est référencé. La classification reste descriptive et ne fournit aucune procédure de préparation.",
        "declared_variety": "Assemblage fictif à dominante boisée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Bubble Hash — classification descriptive",
        "texture": "Résineuse et granuleuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Assemblage fictif à dominante boisée", "display": "Assemblage fictif à dominante boisée"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "texture": {"value": "resinous", "display": "Résineuse — appréciation illustrative", "option": "resinous"},
          "aromas": {"value": ["boisé", "floral", "terreux"], "display": "Boisé, floral, terreux — descripteurs fictifs"}
        }
      },
      {
        "seed_key": "demo.rosin.flower",
        "short_description": "Flower Rosin fictif à la teinte ambrée claire et à la texture souple de type Fresh Press.",
        "full_description": "Cette fiche montre comment documenter un rosin dont la matière de départ déclarée est la fleur. La teinte miel, la transparence et la texture souple constituent un exemple éditorial fictif.\n\nAucune origine, composition analytique ou identité de producteur n’est attribuée. Le procédé est seulement nommé pour la classification et n’est pas détaillé.",
        "declared_variety": "Profil floral fictif",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Flower Rosin — classification descriptive",
        "texture": "Souple et ambrée — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil floral fictif", "display": "Profil floral fictif"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "starting_material": {"value": "flower", "display": "Fleur", "option": "flower"},
          "texture": {"value": "fresh-press", "display": "Fresh Press — appréciation illustrative", "option": "fresh-press"}
        }
      },
      {
        "seed_key": "demo.rosin.hash",
        "short_description": "Hash Rosin fictif à la teinte crème dorée et à la texture homogène classée Cold Cure.",
        "full_description": "Cette entrée présente un exemple de Hash Rosin avec une apparence crémeuse, mate et homogène. La matière de départ et la texture sélectionnées servent à illustrer les filtres structurés du catalogue.\n\nIl ne s’agit pas d’un produit identifié : aucune marque, analyse ou origine réelle n’est associée. Aucun paramètre de transformation n’est communiqué.",
        "declared_variety": "Profil fictif fruité et floral",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Hash Rosin — classification descriptive",
        "texture": "Crémeuse et homogène — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif fruité et floral", "display": "Profil fictif fruité et floral"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "starting_material": {"value": "hash", "display": "Hash", "option": "hash"},
          "texture": {"value": "cold-cure", "display": "Cold Cure — appréciation illustrative", "option": "cold-cure"}
        }
      },
      {
        "seed_key": "demo.solvent.live-resin",
        "short_description": "Live Resin fictive à l’apparence brillante et visqueuse, classée dans les extractions avec solvants.",
        "full_description": "Cette fiche illustre une Live Resin à la teinte dorée, avec une phase visuellement fluide et brillante. Ces éléments sont des descripteurs fictifs permettant de présenter les champs propres à la catégorie.\n\nLa matière, le producteur, les solvants et les données analytiques ne sont pas attribués à un produit réel. Aucune procédure ni recommandation n’est fournie.",
        "declared_variety": "Profil fictif agrumes et herbes",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Extraction avec solvant — classification uniquement",
        "texture": "Brillante et visqueuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif agrumes et herbes", "display": "Profil fictif agrumes et herbes"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "extraction_type": {"value": "live-resin", "display": "Live Resin", "option": "live-resin"},
          "texture": {"value": "sauce", "display": "Sauce — appréciation illustrative", "option": "sauce"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.solvent.shatter",
        "short_description": "Shatter fictif sous forme de plaque ambrée translucide, décrit sans donnée de composition réelle.",
        "full_description": "Cette entrée représente la sous-catégorie Shatter par une plaque fine, cassante et translucide aux reflets ambrés. L’exemple sert à démontrer la combinaison du type d’extraction et de la texture.\n\nAucun producteur, lot, composition ou contrôle analytique réel n’est cité. La fiche reste descriptive et ne contient aucun protocole.",
        "declared_variety": "Profil fictif boisé et citronné",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Extraction avec solvant — classification uniquement",
        "texture": "Plaque cassante et translucide — illustration",
        "country": null,
        "region": null,
        "fields": {
          "declared_variety": {"value": "Profil fictif boisé et citronné", "display": "Profil fictif boisé et citronné"},
          "declared_producer": {"value": "Non attribué — fiche fictive", "display": "Non attribué — fiche fictive"},
          "extraction_type": {"value": "cured-resin", "display": "Cured Resin — classification illustrative", "option": "cured-resin"},
          "texture": {"value": "shatter", "display": "Shatter", "option": "shatter"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.vape.cartridge",
        "short_description": "Cartouche 510 fictive au réservoir transparent, utilisée comme illustration neutre du format vape.",
        "full_description": "Cette fiche présente un dispositif générique au format Cartridge 510 avec un petit réservoir transparent et un liquide ambré illustratif. La capacité indiquée permet de démontrer le champ numérique de la catégorie.\n\nAucun fabricant, liquide, composition ou appareil réel n’est identifié. L’entrée ne constitue pas une recommandation d’utilisation.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Cartouche 510 — classification descriptive",
        "texture": "Liquide ambré — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "cartridge-510", "display": "Cartridge 510", "option": "cartridge-510"},
          "extract_type": {"value": "full-spectrum", "display": "Full Spectrum — classification fictive", "option": "full-spectrum"},
          "declared_capacity": {"value": 0.5, "display": "0,5 mL — valeur fictive"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.vape.disposable",
        "short_description": "Dispositif vape jetable fictif au corps compact, présenté comme photo et donnée d’illustration.",
        "full_description": "Cette entrée montre le format Disposable au moyen d’un dispositif compact et neutre. La capacité et le type d’extrait sont des valeurs fictives utilisées pour rendre les filtres de démonstration visibles.\n\nAucune marque, formulation, performance ou provenance réelle n’est associée. La fiche est une classification éditoriale et non un conseil d’utilisation.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Disposable — classification descriptive",
        "texture": "Liquide doré — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "disposable", "display": "Disposable", "option": "disposable"},
          "extract_type": {"value": "broad-spectrum", "display": "Broad Spectrum — classification fictive", "option": "broad-spectrum"},
          "declared_capacity": {"value": 1.0, "display": "1,0 mL — valeur fictive"},
          "declared_cannabinoids": {"value": "Aucune donnée analytique déclarée — fiche fictive.", "display": "Aucune donnée analytique déclarée — fiche fictive."}
        }
      },
      {
        "seed_key": "demo.edibles.gummies",
        "short_description": "Confiseries gélifiées fictives aux couleurs fruitées, utilisées comme illustration du format Gummies.",
        "full_description": "Cette fiche illustre le format Gummies avec des formes gélifiées colorées et une composition volontairement générique. Les couleurs, arômes et informations structurées ne décrivent aucun article réel.\n\nAucune teneur, portion, marque ou disponibilité n’est indiquée. L’entrée sert exclusivement d’exemple visuel et taxonomique.",
        "declared_variety": "Composition fruitée fictive",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Gummies — classification descriptive",
        "texture": "Gélifiée et souple — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "gummies", "display": "Gummies", "option": "gummies"},
          "declared_composition": {"value": "Base gélifiée fruitée fictive; composition réelle non renseignée.", "display": "Base gélifiée fruitée fictive; composition réelle non renseignée."},
          "declared_cannabinoids": {"value": "Aucune teneur analytique déclarée — fiche fictive.", "display": "Aucune teneur analytique déclarée — fiche fictive."},
          "allergens": {"value": "Non renseignés — illustration uniquement.", "display": "Non renseignés — illustration uniquement."}
        }
      },
      {
        "seed_key": "demo.edibles.drink",
        "short_description": "Boisson au chanvre fictive à la robe ambrée claire, présentée comme illustration neutre de la catégorie.",
        "full_description": "Cette entrée représente le format Boissons avec une tasse et une infusion ambrée utilisées à titre d’illustration. La composition déclarée reste volontairement générique afin de montrer les champs sans simuler une référence existante.\n\nAucune teneur, portion, marque ou propriété particulière n’est revendiquée. Cette fiche n’est associée à aucun produit consommable réel.",
        "declared_variety": "Infusion fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Boisson — classification descriptive",
        "texture": "Liquide ambré clair — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "boissons", "display": "Boissons", "option": "boissons"},
          "declared_composition": {"value": "Infusion végétale fictive; composition réelle non renseignée.", "display": "Infusion végétale fictive; composition réelle non renseignée."},
          "declared_cannabinoids": {"value": "Aucune teneur analytique déclarée — fiche fictive.", "display": "Aucune teneur analytique déclarée — fiche fictive."},
          "allergens": {"value": "Non renseignés — illustration uniquement.", "display": "Non renseignés — illustration uniquement."}
        }
      },
      {
        "seed_key": "demo.topical.cream",
        "short_description": "Crème topique fictive à la texture légère et homogène, illustrée dans un contenant générique.",
        "full_description": "Cette fiche montre le format Crème dans la catégorie des topiques. La texture claire, l’aspect homogène et le contenant neutre sont des éléments d’illustration sans référence à une formule existante.\n\nAucune composition, indication ou propriété cosmétique ou médicale n’est revendiquée. Aucun fabricant ou article réel n’est associé.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Crème topique — classification descriptive",
        "texture": "Légère et homogène — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "creme", "display": "Crème", "option": "creme"},
          "declared_composition": {"value": "Base crémeuse non spécifiée; composition entièrement fictive.", "display": "Base crémeuse non spécifiée; composition entièrement fictive."},
          "texture": {"value": "Légère, lisse et homogène — appréciation illustrative.", "display": "Légère, lisse et homogène — appréciation illustrative."}
        }
      },
      {
        "seed_key": "demo.topical.balm",
        "short_description": "Baume topique fictif à la texture dense et cireuse, présenté dans un conditionnement neutre.",
        "full_description": "Cette entrée illustre le format Baume avec une matière visuellement dense et un contenant générique. Les caractéristiques servent à différencier ce format de la crème dans les exemples du catalogue.\n\nAucune composition, indication ou propriété cosmétique ou médicale n’est revendiquée. La fiche ne représente aucune référence commercialisée.",
        "declared_variety": "Composition fictive non attribuée",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Baume topique — classification descriptive",
        "texture": "Dense et cireuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "format": {"value": "baume", "display": "Baume", "option": "baume"},
          "declared_composition": {"value": "Base cireuse non spécifiée; composition entièrement fictive.", "display": "Base cireuse non spécifiée; composition entièrement fictive."},
          "texture": {"value": "Dense, cireuse et mate — appréciation illustrative.", "display": "Dense, cireuse et mate — appréciation illustrative."}
        }
      },
      {
        "seed_key": "demo.solventless.static",
        "short_description": "Static Sift fictif à l’aspect poudreux blond, classé parmi les concentrés sans solvant.",
        "full_description": "Cette fiche représente la sous-catégorie Static Sift au moyen d’une matière fine, claire et visuellement homogène. Les descripteurs sont fictifs et servent à rendre les filtres de la catégorie compréhensibles.\n\nAucun grade, rendement, lot ou producteur réel n’est associé. Le type est nommé sans décrire de procédure de transformation.",
        "declared_variety": "Profil fictif floral et épicé",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Static Sift — classification descriptive",
        "texture": "Fine et sableuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "concentrate_type": {"value": "static-sift", "display": "Static Sift", "option": "static-sift"},
          "declared_variety": {"value": "Profil fictif floral et épicé", "display": "Profil fictif floral et épicé"},
          "texture": {"value": "sandy", "display": "Sableuse — appréciation illustrative", "option": "sandy"}
        }
      },
      {
        "seed_key": "demo.solventless.live-rosin",
        "short_description": "Live Rosin fictif à la teinte crème dorée et à la texture résineuse, sans donnée analytique réelle.",
        "full_description": "Cette entrée illustre la sous-catégorie Live Rosin avec une matière brillante, souple et crème dorée. Le type Rosin et la texture résineuse sont renseignés pour démontrer les champs communs aux concentrés sans solvant.\n\nLa variété, le producteur, la composition et l’origine sont fictifs ou non attribués. Aucun paramètre de transformation ni résultat de laboratoire n’est présenté.",
        "declared_variety": "Profil fictif fruité et herbacé",
        "declared_producer": "Non attribué — fiche fictive",
        "method": "Live Rosin — classification descriptive",
        "texture": "Résineuse et crémeuse — illustration",
        "country": null,
        "region": null,
        "fields": {
          "concentrate_type": {"value": "rosin", "display": "Rosin", "option": "rosin"},
          "declared_variety": {"value": "Profil fictif fruité et herbacé", "display": "Profil fictif fruité et herbacé"},
          "texture": {"value": "resinous", "display": "Résineuse — appréciation illustrative", "option": "resinous"}
        }
      }
    ]
    $demo$::jsonb) as demo_content(
      seed_key text,
      short_description text,
      full_description text,
      declared_variety text,
      declared_producer text,
      method text,
      texture text,
      country text,
      region text,
      fields jsonb
    )
  loop
    update public.entries as e
    set short_description = content.short_description,
        full_description = content.full_description,
        declared_variety = content.declared_variety,
        declared_producer = content.declared_producer,
        method = content.method,
        texture = content.texture,
        country = content.country,
        region = content.region,
        updated_at = now()
    where e.seed_key = content.seed_key
      and e.is_demo
      and (e.short_description,e.full_description,e.declared_variety,e.declared_producer,
        e.method,e.texture,e.country,e.region) is distinct from
        (content.short_description,content.full_description,content.declared_variety,
        content.declared_producer,content.method,content.texture,content.country,content.region);

    for field_item in
      select key as field_key,value as field_data
      from jsonb_each(content.fields)
    loop
      insert into public.entry_field_values as existing(
        id,entry_id,field_definition_id,option_id,value,display_value,created_at,updated_at)
      select extensions.gen_random_uuid(),e.id,d.id,o.id,field_item.field_data->'value',
        field_item.field_data->>'display',now(),now()
      from public.entries e
      join public.dynamic_field_definitions d on d.category_id=e.category_id
        and d.subcategory_id is null and d.key=field_item.field_key and d.deleted_at is null
      left join public.dynamic_field_options o on o.field_definition_id=d.id
        and o.value=field_item.field_data->>'option' and o.is_active
      where e.seed_key=content.seed_key and e.is_demo
        and (not (field_item.field_data ? 'option') or o.id is not null)
      on conflict(entry_id,field_definition_id) do update
      set option_id=excluded.option_id,
          value=excluded.value,
          display_value=excluded.display_value,
          updated_at=now()
      where (existing.option_id,existing.value,existing.display_value) is distinct from
        (excluded.option_id,excluded.value,excluded.display_value);
    end loop;
  end loop;
end $$;

commit;
