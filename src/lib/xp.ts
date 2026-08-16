export const BASE_LEVELS = [
  { level: 1, threshold: 0, title: "Novice" },
  { level: 2, threshold: 100, title: "Observateur" },
  { level: 3, threshold: 250, title: "Explorateur" },
  { level: 4, threshold: 450, title: "Chercheur" },
  { level: 5, threshold: 700, title: "Dresseur" },
  { level: 6, threshold: 1_000, title: "Dresseur confirmé" },
  { level: 7, threshold: 1_400, title: "Dresseur expert" },
  { level: 8, threshold: 1_900, title: "Archiviste Pokédex" },
  { level: 9, threshold: 2_500, title: "Expert Pokédex" },
  { level: 10, threshold: 3_250, title: "Maître Dresseur" },
  { level: 11, threshold: 4_150, title: "Conservateur" },
  { level: 12, threshold: 5_250, title: "Maître Archiviste" },
  { level: 13, threshold: 6_600, title: "Érudit Pokédex" },
  { level: 14, threshold: 8_250, title: "Gardien des Archives" },
  { level: 15, threshold: 10_250, title: "Légende PokéTerps" },
] as const;

export type ExperienceLevel = { level: number; threshold: number; title: string };
export type ExperienceDisplayRole = "OWNER" | "ADMIN" | string | null | undefined;

const RARE_TITLES = ["Légende confirmée", "Sage du Pokédex", "Icône des Archives"] as const;

export function experienceThresholdForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const known = BASE_LEVELS.find((definition) => definition.level === safeLevel);
  if (known) return known.threshold;
  let threshold = BASE_LEVELS.at(-1)?.threshold ?? 10_250;
  for (let current = 16; current <= safeLevel; current += 1) {
    threshold += 2_000 + (current - 15) * 300;
  }
  return threshold;
}

export function levelFromExperience(experiencePoints: number): number {
  const xp = Math.max(0, Math.floor(experiencePoints));
  let level = 1;
  while (experienceThresholdForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function titleForLevel(level: number): string {
  const known = BASE_LEVELS.find((definition) => definition.level === Math.floor(level));
  if (known) return known.title;
  return RARE_TITLES[Math.min(RARE_TITLES.length - 1, Math.floor((level - 16) / 5))] ?? "Légende";
}

export function experienceProgress(experiencePoints: number) {
  const xp = Math.max(0, Math.floor(experiencePoints));
  const level = levelFromExperience(xp);
  const currentThreshold = experienceThresholdForLevel(level);
  const nextThreshold = experienceThresholdForLevel(level + 1);
  const span = Math.max(1, nextThreshold - currentThreshold);
  return {
    level,
    title: titleForLevel(level),
    experiencePoints: xp,
    currentThreshold,
    nextThreshold,
    remaining: Math.max(0, nextThreshold - xp),
    percent: Math.min(100, Math.max(0, ((xp - currentThreshold) / span) * 100)),
  };
}

export function experienceProgressFromLevels(
  experiencePoints: number,
  definitions: readonly ExperienceLevel[],
) {
  const levels = [...definitions]
    .filter(
      (item) => Number.isFinite(item.level) && Number.isFinite(item.threshold) && item.level > 0,
    )
    .sort((left, right) => left.level - right.level);
  if (!levels.length) return experienceProgress(experiencePoints);
  const xp = Math.max(0, Math.floor(experiencePoints));
  const current = [...levels].reverse().find((item) => item.threshold <= xp) ?? levels[0];
  const next = levels.find((item) => item.level > current.level) ?? current;
  const isMaxLevel = next.level === current.level;
  const span = Math.max(1, next.threshold - current.threshold);
  return {
    level: current.level,
    title: current.title,
    experiencePoints: xp,
    currentThreshold: current.threshold,
    nextThreshold: next.threshold,
    remaining: isMaxLevel ? 0 : Math.max(0, next.threshold - xp),
    percent: isMaxLevel ? 100 : Math.min(100, Math.max(0, ((xp - current.threshold) / span) * 100)),
    isMaxLevel,
  };
}

export function effectiveExperienceProgress(
  realExperiencePoints: number,
  role: ExperienceDisplayRole,
  definitions: readonly ExperienceLevel[] = BASE_LEVELS,
) {
  const realProgress = experienceProgressFromLevels(realExperiencePoints, definitions);
  if (role !== "OWNER" && role !== "ADMIN") {
    return {
      ...realProgress,
      realExperiencePoints: realProgress.experiencePoints,
      isRoleBoosted: false,
      roleBoostRole: null,
    };
  }
  const highest = [...definitions]
    .filter((item) => Number.isFinite(item.level) && Number.isFinite(item.threshold))
    .sort((left, right) => right.level - left.level)[0];
  if (!highest) return effectiveExperienceProgress(realExperiencePoints, null, BASE_LEVELS);
  const boostedRole: "OWNER" | "ADMIN" = role === "OWNER" ? "OWNER" : "ADMIN";
  return {
    level: highest.level,
    title: highest.title,
    experiencePoints: highest.threshold,
    currentThreshold: highest.threshold,
    nextThreshold: highest.threshold,
    remaining: 0,
    percent: 100,
    isMaxLevel: true,
    realExperiencePoints: realProgress.experiencePoints,
    isRoleBoosted: true,
    roleBoostRole: boostedRole,
  };
}
