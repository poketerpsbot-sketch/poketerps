import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const PRIVATE_STORAGE_SIGNED_URL_TTL_SECONDS = 5 * 60;

type SignablePrivateBucket = "message-attachments" | "contest-results";

export function publicStorageUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${getEnv().SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;
}

/**
 * Signs private objects server-side in one Storage request. The private bucket
 * allowlist and fixed short TTL prevent this service-role helper from becoming
 * a general-purpose signer for arbitrary database values.
 */
export async function signedStorageUrls(
  bucket: SignablePrivateBucket,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter((path) => path.length > 0))];
  if (uniquePaths.length === 0) return new Map();

  const env = getEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, PRIVATE_STORAGE_SIGNED_URL_TTL_SECONDS);

  if (error) {
    throw new AppError(
      "STORAGE_SIGNED_URL_FAILED",
      "Les pièces jointes privées ne peuvent pas être ouvertes pour le moment.",
      502,
      { cause: error },
    );
  }

  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
