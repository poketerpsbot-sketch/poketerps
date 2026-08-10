const MICRON_SUBCATEGORIES: Readonly<Record<string, ReadonlySet<string>>> = {
  hash: new Set([
    "dry-sift",
    "static-sift",
    "bubble-hash",
    "ice-water-hash",
    "full-melt",
    "half-melt",
    "piatella",
  ]),
  rosin: new Set(["flower-rosin", "hash-rosin", "live-rosin"]),
  "concentres-sans-solvant": new Set([
    "dry-sift",
    "static-sift",
    "bubble-hash",
    "ice-water-hash",
    "full-melt",
    "half-melt",
    "piatella",
    "rosin",
    "hash-rosin",
    "flower-rosin",
    "live-rosin",
  ]),
};

export function isMicronApplicable(
  categorySlug?: string | null,
  subcategorySlug?: string | null,
): boolean {
  if (!categorySlug || !subcategorySlug) return false;
  return MICRON_SUBCATEGORIES[categorySlug]?.has(subcategorySlug) ?? false;
}
