import type { PublicProfileDto, TrainerRankingDto } from "@/components/data/types";

export function trainerProfile(ranking: TrainerRankingDto): PublicProfileDto {
  return (
    ranking.user ??
    ranking.profile ?? {
      id: ranking.userId,
      displayName: ranking.displayName ?? "Dresseur",
      publicSlug: ranking.publicSlug ?? ranking.slug,
      telegramUsername: ranking.telegramUsername ?? ranking.username,
      profilePhotoUrl: ranking.profilePhotoUrl,
      profileTitle: ranking.profileTitle,
      level: ranking.level,
      experiencePoints: ranking.experiencePoints,
    }
  );
}

function normalizedUsername(value?: string | null) {
  const username = value?.trim().replace(/^@+/, "");
  return username || null;
}

export function trainerIdentity(ranking: TrainerRankingDto) {
  const user = trainerProfile(ranking);
  const username = normalizedUsername(user.telegramUsername ?? ranking.telegramUsername);
  const displayName = user.displayName?.trim() || "Dresseur";
  const sameIdentity =
    username &&
    displayName.replace(/^@+/, "").toLocaleLowerCase("fr-FR") ===
      username.toLocaleLowerCase("fr-FR");

  return {
    user,
    username,
    primary: username ? `@${username}` : displayName,
    secondary: sameIdentity
      ? user.profileTitle || "Dresseur"
      : username
        ? displayName
        : user.profileTitle || "Dresseur",
  };
}
