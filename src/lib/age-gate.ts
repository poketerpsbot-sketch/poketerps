export const AGE_GATE_COOKIE_NAME = "pokedex-age-gate";
export const AGE_GATE_STORAGE_KEY = "pokedex-age-gate:v1";
export const AGE_GATE_CONFIRMED_VALUE = "yes";
export const AGE_GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isAgeGateConfirmed(value: string | null | undefined) {
  return value === AGE_GATE_CONFIRMED_VALUE;
}

export function safeAgeGateReturnUrl(requestUrl: string, referer: string | null) {
  const fallback = new URL("/", requestUrl);
  if (!referer) return fallback;

  try {
    const source = new URL(requestUrl);
    const target = new URL(referer);
    if (target.origin !== source.origin) return fallback;
    return new URL(`${target.pathname}${target.search}${target.hash}`, source.origin);
  } catch {
    return fallback;
  }
}
