export type MicronContextType = "COLLECTION_SEPARATION" | "PRESSING_BAG";

export type MicronPreset = {
  value: string;
  label: string;
  mode: "NONE" | "SINGLE" | "RANGE" | "MULTIPLE" | "FULL_SPECTRUM" | "MIXED";
  singleValue?: number;
  minimumValue?: number;
  maximumValue?: number;
  multipleValues?: number[];
};

export type MicronProfile = {
  context: MicronContextType;
  label: string;
  helpText: string;
  presets: readonly MicronPreset[];
  allowCustomRange: boolean;
};

export type ConfiguredMicronPreset = {
  id: string | number;
  slug: string;
  context: MicronContextType;
  mode: MicronPreset["mode"];
  label: string;
  displayName?: string | null;
  frenchExplanation?: string | null;
  singleValue?: number | null;
  minimumValue?: number | null;
  maximumValue?: number | null;
  multipleValues?: number[] | null;
};

const unspecified: MicronPreset = {
  value: "none",
  label: "Non précisé",
  mode: "NONE",
};

function singles(values: readonly number[]): MicronPreset[] {
  return values.map((value) => ({
    value: `single-${value}`,
    label: `${value} µm`,
    mode: "SINGLE" as const,
    singleValue: value,
  }));
}

function range(minimumValue: number, maximumValue: number): MicronPreset {
  return {
    value: `range-${minimumValue}-${maximumValue}`,
    label: `${minimumValue}–${maximumValue} µm`,
    mode: "RANGE",
    minimumValue,
    maximumValue,
  };
}

const fullSpectrum: MicronPreset = {
  value: "full-spectrum",
  label: "Full Spectrum",
  mode: "FULL_SPECTRUM",
};

const mixedMicron: MicronPreset = {
  value: "mixed-micron",
  label: "Mixed Micron",
  mode: "MIXED",
};

const bubbleCollection: MicronProfile = {
  context: "COLLECTION_SEPARATION",
  label: "Fraction / plage de microns",
  helpText:
    "Les microns indiquent ici la taille de maille de filtration ou de collecte déclarée. Ils ne déterminent pas automatiquement la qualité.",
  presets: [
    unspecified,
    ...singles([220, 190, 160, 120, 90, 73, 45, 25]),
    range(45, 159),
    range(73, 159),
    range(90, 120),
    range(73, 120),
    fullSpectrum,
    mixedMicron,
  ],
  allowCustomRange: true,
};

const drySiftCollection: MicronProfile = {
  context: "COLLECTION_SEPARATION",
  label: "Microns de tamisage à sec (facultatif)",
  helpText:
    "Renseigne la maille déclarée du tamis ou une plage. Le champ reste facultatif lorsque la donnée est inconnue.",
  presets: [
    unspecified,
    ...singles([250, 220, 190, 160, 150, 120, 90, 75, 73, 45, 25]),
    fullSpectrum,
    mixedMicron,
  ],
  allowCustomRange: true,
};

const staticCollection: MicronProfile = {
  context: "COLLECTION_SEPARATION",
  label: "Fraction de Static Sift (facultatif)",
  helpText:
    "Static Sift désigne ici un dry sift purifié par séparation statique. La fraction est déclarative.",
  presets: [unspecified, ...singles([45, 73, 90, 120]), mixedMicron],
  allowCustomRange: true,
};

function pressingBag(values: readonly number[], material: string): MicronProfile {
  return {
    context: "PRESSING_BAG",
    label: "Micron du sac de pressage",
    helpText: `Taille de maille du sac utilisé pour presser ${material}. Cette donnée est distincte de la fraction de hash utilisée.`,
    presets: [unspecified, ...singles(values)],
    allowCustomRange: false,
  };
}

const hashRosinBag = pressingBag([5, 15, 25, 37, 45], "le hash"),
  drySiftRosinBag = pressingBag([15, 25, 37, 45, 73], "le dry sift"),
  flowerRosinBag = pressingBag([75, 90, 120, 160], "la fleur");

const bubbleSlugs = new Set(["bubble-hash", "ice-water-hash", "ice-hash"]);
const drySiftSlugs = new Set([
  "dry-sift",
  "frozen-dry-sift",
  "dry-sift-presse",
  "dry-sift-non-presse",
  "full-spectrum-dry-sift",
  "single-fraction",
  "mixed-fraction",
]);
const staticSlugs = new Set(["static-sift", "static-tech"]);

export function micronProfilesFor(
  categorySlug?: string | null,
  subcategorySlug?: string | null,
  configuredPresets?: readonly ConfiguredMicronPreset[],
): readonly MicronProfile[] {
  if (!categorySlug || !subcategorySlug) return [];
  const hashLike = categorySlug === "hash" || categorySlug === "concentres-sans-solvant";
  let fallback: readonly MicronProfile[] = [];
  if (hashLike && bubbleSlugs.has(subcategorySlug)) fallback = [bubbleCollection];
  if (hashLike && drySiftSlugs.has(subcategorySlug)) fallback = [drySiftCollection];
  if (hashLike && staticSlugs.has(subcategorySlug)) fallback = [staticCollection];

  if (
    fallback.length === 0 &&
    (categorySlug === "rosin" || categorySlug === "concentres-sans-solvant")
  ) {
    if (["hash-rosin", "bubble-hash-rosin", "live-rosin"].includes(subcategorySlug)) {
      fallback = [bubbleCollection, hashRosinBag];
    }
    if (subcategorySlug === "dry-sift-rosin") fallback = [drySiftCollection, drySiftRosinBag];
    if (subcategorySlug === "flower-rosin") fallback = [flowerRosinBag];
  }

  if (configuredPresets === undefined) return fallback;
  if (configuredPresets.length === 0) return [];
  const contexts = ["COLLECTION_SEPARATION", "PRESSING_BAG"] as const;
  return contexts.flatMap((context) => {
    const configured = configuredPresets.filter((preset) => preset.context === context);
    if (configured.length === 0) return [];
    const fallbackProfile = fallback.find((profile) => profile.context === context);
    const hasCustom = configured.some((preset) => preset.slug.includes("custom"));
    const mappedPresets = configured
      .filter((preset) => !preset.slug.includes("custom"))
      .map<MicronPreset>((preset) => ({
        value:
          preset.mode === "NONE" || preset.slug.includes("not-specified")
            ? "none"
            : `preset-${preset.id}`,
        label: preset.displayName || preset.label,
        mode: preset.mode,
        singleValue: preset.singleValue ?? undefined,
        minimumValue: preset.minimumValue ?? undefined,
        maximumValue: preset.maximumValue ?? undefined,
        multipleValues: preset.multipleValues ?? undefined,
      }));
    const presets = Array.from(
      new Map(mappedPresets.map((preset) => [preset.value, preset])).values(),
    );
    if (!presets.some((preset) => preset.value === "none")) presets.unshift(unspecified);
    return [
      {
        context,
        label:
          fallbackProfile?.label ??
          (context === "PRESSING_BAG"
            ? "Micron du sac de pressage"
            : "Fraction / plage de microns"),
        helpText:
          configured.find((preset) => preset.frenchExplanation)?.frenchExplanation ??
          fallbackProfile?.helpText ??
          "Valeur technique dÃ©clarÃ©e par le contributeur et configurable par lâ€™Ã©quipe.",
        presets,
        allowCustomRange: hasCustom,
      },
    ];
  });
}

export const taxonomyExplanations: Readonly<Record<string, string>> = {
  "dry-sift": "Tamisage à sec des trichomes.",
  "bubble-hash": "Hash séparé mécaniquement à l’eau glacée.",
  "ice-water-hash": "Séparation mécanique à l’eau glacée.",
  "static-sift": "Dry sift purifié par séparation statique.",
  "fresh-frozen": "Matière fraîche congelée rapidement après récolte.",
  "cold-cure": "Texture obtenue après maturation à froid.",
  "fresh-press": "Rosin fraîchement pressée.",
  "full-melt": "Classification déclarée de hash à forte capacité de fusion.",
  "half-melt": "Classification déclarée de hash à fusion partielle.",
};
