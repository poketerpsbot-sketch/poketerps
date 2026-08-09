export type MutationResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  message: string;
};

export async function submitJson<T = unknown>(
  url: string,
  method: string,
  body: unknown,
): Promise<MutationResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      data?: T;
      message?: string;
      error?: string | { message?: string };
    } | null;
    const error = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
    return {
      ok: response.ok,
      status: response.status,
      data: payload?.data ?? null,
      message:
        error ??
        payload?.message ??
        (response.ok ? "Enregistrement terminé." : "La requête a été refusée."),
    };
  } catch {
    return {
      ok: false,
      status: 503,
      data: null,
      message: "Le service est injoignable. Vérifie ta connexion puis réessaie.",
    };
  }
}

export async function uploadImage(file: File, bucket: string, relatedId?: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("bucket", bucket);
  if (relatedId) body.set("relatedId", relatedId);
  try {
    const response = await fetch("/api/storage/upload", { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as {
      data?: { path?: string; publicUrl?: string };
      error?: { message?: string };
    } | null;
    if (!response.ok)
      throw new Error(payload?.error?.message ?? "L’image n’a pas pu être envoyée.");
    return payload?.data ?? null;
  } catch (error) {
    throw error instanceof Error ? error : new Error("L’image n’a pas pu être envoyée.");
  }
}

export function validateImage(file: File | undefined, maxBytes = 8 * 1024 * 1024) {
  if (!file) return null;
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  if (!allowed.has(file.type)) return "Format non accepté. Utilise JPEG, PNG, WebP ou AVIF.";
  if (file.size > maxBytes)
    return `L’image dépasse la limite de ${Math.round(maxBytes / 1024 / 1024)} Mo.`;
  return null;
}
