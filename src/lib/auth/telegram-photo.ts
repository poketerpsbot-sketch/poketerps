export function telegramPhotoUpdate(photoUrl?: string | null) {
  const normalized = photoUrl?.trim();
  return normalized ? { profilePhotoUrl: normalized } : {};
}
