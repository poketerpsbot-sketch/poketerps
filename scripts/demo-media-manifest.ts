export const DEMO_CATEGORY_SLUGS = [
  "fleur",
  "pre-roll",
  "hash",
  "rosin",
  "extractions-solvants",
  "vape",
  "edibles",
  "topiques",
  "concentres-sans-solvant",
] as const;

export type DemoCategorySlug = (typeof DEMO_CATEGORY_SLUGS)[number];

export type ReusableMediaLicense =
  | "CC0"
  | "Public domain"
  | "CC BY 2.0"
  | "CC BY 2.5"
  | "CC BY 3.0"
  | "CC BY 4.0"
  | "CC BY-SA 2.0"
  | "CC BY-SA 3.0"
  | "CC BY-SA 4.0";

export type DemoMediaItem = {
  readonly seedKey: string;
  readonly entryId: string;
  readonly categorySlug: DemoCategorySlug;
  readonly imageId: string;
  readonly objectPath: string;
  readonly commonsFileTitle: `File:${string}`;
  readonly sourcePage: `https://commons.wikimedia.org/wiki/File:${string}`;
  readonly author: string;
  readonly licenseName: ReusableMediaLicense;
  readonly licenseUrl: `https://${string}`;
  readonly altText: string;
};

type DemoMediaSource = Omit<DemoMediaItem, "objectPath">;

const sources: readonly DemoMediaSource[] = [
  {
    seedKey: "demo.flower.indoor",
    entryId: "10000000-0000-4000-8000-000000000001",
    categorySlug: "fleur",
    imageId: "20000000-0000-4000-8000-000000000001",
    commonsFileTitle: "File:Cannabis plant below a grow light.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Cannabis_plant_below_a_grow_light.jpg",
    author: "Cannabis Tours",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    altText: "Photo d’illustration : plante de cannabis placée sous une lampe horticole.",
  },
  {
    seedKey: "demo.flower.outdoor",
    entryId: "10000000-0000-4000-8000-000000000002",
    categorySlug: "fleur",
    imageId: "20000000-0000-4000-8000-000000000002",
    commonsFileTitle: "File:Close-Up of Cannabis Plant in Sunlight.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Close-Up_of_Cannabis_Plant_in_Sunlight.jpg",
    author: "Soyamol17",
    licenseName: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    altText: "Photo d’illustration : plante de cannabis éclairée par le soleil.",
  },
  {
    seedKey: "demo.pre-roll.joint",
    entryId: "10000000-0000-4000-8000-000000000003",
    categorySlug: "pre-roll",
    imageId: "20000000-0000-4000-8000-000000000003",
    commonsFileTitle: "File:Cannabis joint.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Cannabis_joint.jpg",
    author: "elsaolofsson",
    licenseName: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    altText: "Photo d’illustration : joint de cannabis posé sur une surface claire.",
  },
  {
    seedKey: "demo.pre-roll.cone",
    entryId: "10000000-0000-4000-8000-000000000004",
    categorySlug: "pre-roll",
    imageId: "20000000-0000-4000-8000-000000000004",
    commonsFileTitle: "File:Marijuana joint.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Marijuana_joint.jpg",
    author: "Torben Hansen",
    licenseName: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    altText: "Photo d’illustration : joint utilisé pour représenter le format cone fictif.",
  },
  {
    seedKey: "demo.hash.dry-sift",
    entryId: "10000000-0000-4000-8000-000000000005",
    categorySlug: "hash",
    imageId: "20000000-0000-4000-8000-000000000005",
    commonsFileTitle: "File:Cannabis ground up for dry sifting (17001927486).jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Cannabis_ground_up_for_dry_sifting_(17001927486).jpg",
    author: "Cannabis Pictures",
    licenseName: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    altText: "Photo d’illustration : matière végétale moulue associée au classement Dry Sift.",
  },
  {
    seedKey: "demo.hash.bubble-hash",
    entryId: "10000000-0000-4000-8000-000000000006",
    categorySlug: "hash",
    imageId: "20000000-0000-4000-8000-000000000006",
    commonsFileTitle: "File:Kief.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Kief.jpg",
    author: "Zachary",
    licenseName: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    altText: "Photo d’illustration : kief doré utilisé pour représenter un Bubble Hash fictif.",
  },
  {
    seedKey: "demo.rosin.flower",
    entryId: "10000000-0000-4000-8000-000000000007",
    categorySlug: "rosin",
    imageId: "20000000-0000-4000-8000-000000000007",
    commonsFileTitle: "File:Drop of cannabis oil.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Drop_of_cannabis_oil.jpg",
    author: "HighInBC",
    licenseName: "CC BY 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by/2.5/",
    altText: "Photo d’illustration : goutte d’extrait ambré représentant un Flower Rosin fictif.",
  },
  {
    seedKey: "demo.rosin.hash",
    entryId: "10000000-0000-4000-8000-000000000008",
    categorySlug: "rosin",
    imageId: "20000000-0000-4000-8000-000000000008",
    commonsFileTitle: "File:Hash rosin.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Hash_rosin.jpg",
    author: "Cale Bonner",
    licenseName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    altText: "Photo d’illustration : matière ambrée présentée comme Hash Rosin.",
  },
  {
    seedKey: "demo.solvent.live-resin",
    entryId: "10000000-0000-4000-8000-000000000009",
    categorySlug: "extractions-solvants",
    imageId: "20000000-0000-4000-8000-000000000009",
    commonsFileTitle: "File:Dabbing Hash Oil.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Dabbing_Hash_Oil.jpg",
    author: "Cale Bonner",
    licenseName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    altText:
      "Photo d’illustration : extrait ambré utilisé pour représenter une Live Resin fictive.",
  },
  {
    seedKey: "demo.solvent.shatter",
    entryId: "10000000-0000-4000-8000-000000000010",
    categorySlug: "extractions-solvants",
    imageId: "20000000-0000-4000-8000-000000000010",
    commonsFileTitle: "File:Shatter.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Shatter.jpg",
    author: "Guildextracts",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    altText: "Photo d’illustration : plaque ambrée translucide de type Shatter.",
  },
  {
    seedKey: "demo.vape.cartridge",
    entryId: "10000000-0000-4000-8000-000000000011",
    categorySlug: "vape",
    imageId: "20000000-0000-4000-8000-000000000011",
    commonsFileTitle: "File:A single use cannabis cartridge.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:A_single_use_cannabis_cartridge.jpg",
    author: "UnifiedFunctionality",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    altText: "Photo d’illustration : cartouche de cannabis à usage unique.",
  },
  {
    seedKey: "demo.vape.disposable",
    entryId: "10000000-0000-4000-8000-000000000012",
    categorySlug: "vape",
    imageId: "20000000-0000-4000-8000-000000000012",
    commonsFileTitle: "File:Dispoable cannabis vape.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Dispoable_cannabis_vape.jpg",
    author: "UnifiedFunctionality",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    altText: "Photo d’illustration : dispositif vape jetable au format compact.",
  },
  {
    seedKey: "demo.edibles.gummies",
    entryId: "10000000-0000-4000-8000-000000000013",
    categorySlug: "edibles",
    imageId: "20000000-0000-4000-8000-000000000013",
    commonsFileTitle: "File:Candy.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Candy.jpg",
    author: "Lciuffo",
    licenseName: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    altText:
      "Photo d’illustration : bonbons colorés utilisés pour représenter des Gummies fictifs.",
  },
  {
    seedKey: "demo.edibles.drink",
    entryId: "10000000-0000-4000-8000-000000000014",
    categorySlug: "edibles",
    imageId: "20000000-0000-4000-8000-000000000014",
    commonsFileTitle: "File:CBD hemp tea.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:CBD_hemp_tea.jpg",
    author: "Evopure",
    licenseName: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    altText: "Photo d’illustration : tasse de boisson au chanvre.",
  },
  {
    seedKey: "demo.topical.cream",
    entryId: "10000000-0000-4000-8000-000000000017",
    categorySlug: "topiques",
    imageId: "20000000-0000-4000-8000-000000000017",
    commonsFileTitle:
      "File:Cosmetic jar with light pink product displayed on a textured background.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Cosmetic_jar_with_light_pink_product_displayed_on_a_textured_background.jpg",
    author: "Shixart1985",
    licenseName: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    altText: "Photo d’illustration : pot cosmétique générique contenant une crème claire.",
  },
  {
    seedKey: "demo.topical.balm",
    entryId: "10000000-0000-4000-8000-000000000018",
    categorySlug: "topiques",
    imageId: "20000000-0000-4000-8000-000000000018",
    commonsFileTitle: "File:Lip balm.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Lip_balm.jpg",
    author: "Helar Lukats",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    altText: "Photo d’illustration : baume générique utilisé pour représenter un topique fictif.",
  },
  {
    seedKey: "demo.solventless.static",
    entryId: "10000000-0000-4000-8000-000000000019",
    categorySlug: "concentres-sans-solvant",
    imageId: "20000000-0000-4000-8000-000000000019",
    commonsFileTitle: "File:Kief Weed THC.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Kief_Weed_THC.jpg",
    author: "Psychonaught",
    licenseName: "Public domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Public_domain",
    altText: "Photo d’illustration : kief blond utilisé pour représenter un Static Sift fictif.",
  },
  {
    seedKey: "demo.solventless.live-rosin",
    entryId: "10000000-0000-4000-8000-000000000020",
    categorySlug: "concentres-sans-solvant",
    imageId: "20000000-0000-4000-8000-000000000020",
    commonsFileTitle: "File:Cannabis Trichomes (17300377912).jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Cannabis_Trichomes_(17300377912).jpg",
    author: "Cannabis Pictures",
    licenseName: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    altText:
      "Photo d’illustration : trichomes de cannabis utilisés pour représenter la matière d’un Live Rosin fictif.",
  },
];

export const DEMO_MEDIA_MANIFEST: readonly DemoMediaItem[] = sources.map((source) => ({
  ...source,
  objectPath: `demo/${source.entryId}.webp`,
}));
