import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres, { type Sql } from "postgres";
import sharp from "sharp";

import {
  DEMO_MEDIA_MANIFEST,
  type DemoMediaItem,
  type ReusableMediaLicense,
} from "./demo-media-manifest";

config({ path: ".env.local" });
config();

const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";
const COMMONS_USER_AGENT =
  "PokeTerpsDemoMedia/1.0 (demo media provenance verification; repository maintenance)";
const STORAGE_BUCKET = "entry-images";
const SYSTEM_USER_ID = "00000000-0000-4000-8000-000000000001";
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MEDIA_DOWNLOAD_ATTEMPTS = 6;
const MEDIA_DOWNLOAD_SPACING_MS = 1_200;

const allowedLicenses = new Set<ReusableMediaLicense>([
  "CC0",
  "Public domain",
  "CC BY 2.0",
  "CC BY 2.5",
  "CC BY 3.0",
  "CC BY 4.0",
  "CC BY-SA 2.0",
  "CC BY-SA 3.0",
  "CC BY-SA 4.0",
]);

type CommonsMetadataValue = { value?: string };

type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
  sha1?: string;
  descriptionurl?: string;
  extmetadata?: {
    Artist?: CommonsMetadataValue;
    LicenseShortName?: CommonsMetadataValue;
    LicenseUrl?: CommonsMetadataValue;
  };
};

type CommonsPage = {
  title?: string;
  missing?: boolean;
  imageinfo?: CommonsImageInfo[];
  revisions?: Array<{ slots?: { main?: { content?: string } } }>;
};

type CommonsApiResponse = {
  error?: { code?: string; info?: string };
  query?: { pages?: CommonsPage[] };
};

type VerifiedCommonsSource = {
  sourceUrl: string;
  proxyUrl: string;
  sourceSha1: string;
  sourceMime: string;
  sourceWidth: number;
  sourceHeight: number;
};

type ProcessedImage = {
  data: Buffer;
  width: number;
  height: number;
  byteSize: number;
};

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(60_000, Math.max(1_000, seconds * 1_000));
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(60_000, Math.max(1_000, date - Date.now()));
    }
  }
  return Math.min(30_000, 1_500 * 2 ** (attempt - 1));
}

async function fetchCommonsMedia(sourceUrl: string, proxyUrl: string): Promise<Response> {
  let lastStatus: number | null = null;
  let activeUrl = sourceUrl;
  for (let attempt = 1; attempt <= MEDIA_DOWNLOAD_ATTEMPTS; attempt += 1) {
    let response: Response | null = null;
    let switchedToProxy = false;
    try {
      response = await fetch(activeUrl, {
        headers: { "User-Agent": COMMONS_USER_AGENT },
        signal: AbortSignal.timeout(60_000),
      });
      if (response.ok) return response;
      lastStatus = response.status;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === MEDIA_DOWNLOAD_ATTEMPTS) break;
      if (response.status === 429 && activeUrl !== proxyUrl) {
        activeUrl = proxyUrl;
        switchedToProxy = true;
      }
    } catch {
      if (attempt === MEDIA_DOWNLOAD_ATTEMPTS) break;
    }

    const delayMs = switchedToProxy ? 250 : retryDelayMs(response, attempt);
    await response?.body?.cancel().catch(() => undefined);
    console.warn(
      `Téléchargement Commons différé (${lastStatus ?? "réseau"}), nouvel essai dans ${delayMs} ms.`,
    );
    await wait(delayMs);
  }
  throw new Error(
    `Téléchargement Commons impossible${lastStatus === null ? "" : ` (${lastStatus})`}.`,
  );
}

function usage(): string {
  return [
    "Usage: npm run demo-media:sync -- [--apply]",
    "",
    "Sans --apply : vérifie les 20 sources et licences Wikimedia Commons, sans écrire.",
    "Avec --apply : convertit en WebP, charge dans Supabase Storage et associe les images.",
  ].join("\n");
}

function requireHttpsHost(value: string, expectedHost: string, label: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== expectedHost) {
    throw new Error(`${label} doit utiliser https://${expectedHost}.`);
  }
  return url;
}

function plainMetadata(value: string | undefined): string {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCommonsWikitext(title: string): Promise<string> {
  const parameters = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "revisions",
    titles: title,
    rvprop: "content",
    rvslots: "main",
    rvlimit: "1",
  });
  const response = await fetch(`${COMMONS_API_URL}?${parameters}`, {
    headers: { "User-Agent": COMMONS_USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Lecture du crédit Commons impossible (${response.status}).`);
  const payload = (await response.json()) as CommonsApiResponse;
  if (payload.error) throw new Error(`Wikimedia Commons: ${payload.error.info ?? "erreur"}.`);
  return payload.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? "";
}

async function fetchCommonsMetadata(): Promise<Map<string, VerifiedCommonsSource>> {
  const parameters = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    titles: DEMO_MEDIA_MANIFEST.map((item) => item.commonsFileTitle).join("|"),
    iiprop: "url|mime|size|extmetadata|sha1",
    iiurlwidth: "1600",
    iilimit: "1",
  });
  const response = await fetch(`${COMMONS_API_URL}?${parameters}`, {
    headers: { "User-Agent": COMMONS_USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Wikimedia Commons a répondu ${response.status}.`);
  }

  const payload = (await response.json()) as CommonsApiResponse;
  if (payload.error) {
    throw new Error(
      `Wikimedia Commons: ${payload.error.code ?? "erreur"} — ${payload.error.info ?? "inconnue"}`,
    );
  }

  const pages = payload.query?.pages ?? [];
  const pagesByTitle = new Map(pages.map((page) => [page.title, page]));
  const verified = new Map<string, VerifiedCommonsSource>();

  for (const item of DEMO_MEDIA_MANIFEST) {
    if (!allowedLicenses.has(item.licenseName)) {
      throw new Error(`Licence non autorisée dans le manifeste: ${item.licenseName}.`);
    }
    requireHttpsHost(item.sourcePage, "commons.wikimedia.org", "La page source");

    const page = pagesByTitle.get(item.commonsFileTitle);
    const image = page?.imageinfo?.[0];
    if (!page || page.missing || !image) {
      throw new Error(`Fichier Commons introuvable: ${item.commonsFileTitle}.`);
    }
    if (image.descriptionurl !== item.sourcePage) {
      throw new Error(`Page source inattendue pour ${item.commonsFileTitle}.`);
    }
    const license = image.extmetadata?.LicenseShortName?.value?.trim();
    if (license !== item.licenseName) {
      throw new Error(
        `Licence modifiée pour ${item.commonsFileTitle}: attendu ${item.licenseName}, reçu ${license ?? "aucune"}.`,
      );
    }
    if (!image.mime || !["image/jpeg", "image/png", "image/webp"].includes(image.mime)) {
      throw new Error(
        `MIME non pris en charge pour ${item.commonsFileTitle}: ${image.mime ?? "aucun"}.`,
      );
    }
    const machineReadableArtist = plainMetadata(image.extmetadata?.Artist?.value);
    const expectedAuthor = item.author.toLocaleLowerCase("en");
    if (!machineReadableArtist.toLocaleLowerCase("en").includes(expectedAuthor)) {
      const sourceWikitext = await fetchCommonsWikitext(item.commonsFileTitle);
      if (!sourceWikitext.toLocaleLowerCase("en").includes(expectedAuthor)) {
        throw new Error(`Crédit auteur inattendu pour ${item.commonsFileTitle}: ${item.author}.`);
      }
    }
    const sourceUrl = image.thumburl ?? image.url;
    if (!sourceUrl || !image.url || !image.sha1 || !image.width || !image.height) {
      throw new Error(`Métadonnées incomplètes pour ${item.commonsFileTitle}.`);
    }
    requireHttpsHost(sourceUrl, "upload.wikimedia.org", "Le média source");

    const proxyUrl = new URL("https://commons.wikimedia.org/w/thumb.php");
    proxyUrl.searchParams.set("f", item.commonsFileTitle.slice("File:".length));
    proxyUrl.searchParams.set("w", "1600");

    verified.set(item.commonsFileTitle, {
      sourceUrl,
      proxyUrl: proxyUrl.toString(),
      sourceSha1: image.sha1,
      sourceMime: image.mime,
      sourceWidth: image.width,
      sourceHeight: image.height,
    });
  }

  return verified;
}

async function downloadAndConvert(source: VerifiedCommonsSource): Promise<ProcessedImage> {
  const response = await fetchCommonsMedia(source.sourceUrl, source.proxyUrl);
  const mediaResponseUrl = new URL(response.url);
  const isUploadHost = mediaResponseUrl.hostname === "upload.wikimedia.org";
  const isCommonsProxy =
    mediaResponseUrl.hostname === "commons.wikimedia.org" &&
    mediaResponseUrl.pathname === "/w/thumb.php";
  if (mediaResponseUrl.protocol !== "https:" || (!isUploadHost && !isCommonsProxy)) {
    throw new Error("La réponse média ne provient pas d’un hôte Wikimedia autorisé.");
  }

  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_SOURCE_BYTES) {
    throw new Error(`Le fichier source dépasse ${MAX_SOURCE_BYTES} octets.`);
  }
  const sourceBytes = Buffer.from(await response.arrayBuffer());
  if (sourceBytes.length === 0 || sourceBytes.length > MAX_SOURCE_BYTES) {
    throw new Error("La taille du fichier source est invalide.");
  }

  const converted = await sharp(sourceBytes, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1_600, height: 1_600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  if (!converted.info.width || !converted.info.height || converted.info.size > 10 * 1024 * 1024) {
    throw new Error("Le WebP produit ne respecte pas les limites de entry-images.");
  }

  return {
    data: converted.data,
    width: converted.info.width,
    height: converted.info.height,
    byteSize: converted.info.size,
  };
}

function readApplyConfiguration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
    throw new Error(
      "--apply requiert SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et DIRECT_DATABASE_URL (ou DATABASE_URL).",
    );
  }
  return { supabaseUrl, serviceRoleKey, databaseUrl };
}

function createDatabaseClient(databaseUrl: string): Sql {
  const parsed = new URL(databaseUrl);
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  return postgres(databaseUrl, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
    ssl: isLocal ? false : "require",
  });
}

async function isAlreadySynchronized(
  sql: Sql,
  supabase: SupabaseClient,
  item: DemoMediaItem,
): Promise<boolean> {
  const rows = await sql`
    select 1
    from public.entry_images
    where id=${item.imageId}::uuid
      and entry_id=${item.entryId}::uuid
      and storage_bucket=${STORAGE_BUCKET}
      and object_path=${item.objectPath}
      and mime_type='image/webp'
      and byte_size>0 and width>0 and height>0
      and is_primary and deleted_at is null
      and source_url=${item.sourcePage}
      and credit=${item.author}
      and license_name=${item.licenseName}
      and license_url=${item.licenseUrl}
    limit 1
  `;
  if (rows.length !== 1) return false;

  const separator = item.objectPath.lastIndexOf("/");
  const folder = item.objectPath.slice(0, separator);
  const fileName = item.objectPath.slice(separator + 1);
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(folder, { limit: 10, search: fileName });
  return !error && Boolean(data?.some((object) => object.name === fileName));
}

async function associateImage(sql: Sql, item: DemoMediaItem, image: ProcessedImage): Promise<void> {
  await sql.begin(async (transaction) => {
    const entryRows = await transaction`
      select e.id::text as id,c.slug as category_slug
      from public.entries e
      join public.categories c on c.id=e.category_id
      where e.seed_key=${item.seedKey} and e.is_demo and e.deleted_at is null
      for update of e
    `;
    const entry = entryRows[0] as { id: string; category_slug: string } | undefined;
    if (!entry) throw new Error(`Démo absente ou supprimée: ${item.seedKey}.`);
    if (entry.id !== item.entryId || entry.category_slug !== item.categorySlug) {
      throw new Error(`Identité ou catégorie inattendue pour ${item.seedKey}.`);
    }

    const collisions = await transaction`
      select id::text as id,entry_id::text as entry_id,object_path
      from public.entry_images
      where id=${item.imageId}::uuid
         or (storage_bucket=${STORAGE_BUCKET} and object_path=${item.objectPath})
      for update
    `;
    if (collisions.length > 1) {
      throw new Error(`Plusieurs images entrent en conflit avec ${item.seedKey}.`);
    }
    const collision = collisions[0] as
      { id: string; entry_id: string; object_path: string } | undefined;
    if (
      collision &&
      (collision.id !== item.imageId ||
        collision.entry_id !== item.entryId ||
        collision.object_path !== item.objectPath)
    ) {
      throw new Error(`Une image existante utilise l’identifiant ou le chemin de ${item.seedKey}.`);
    }

    await transaction`
      update public.entry_images
      set is_primary=false,
          kind=case when kind='PRIMARY' then 'GALLERY'::public.entry_image_kind else kind end
      where entry_id=${item.entryId}::uuid and id<>${item.imageId}::uuid
        and is_primary and deleted_at is null
    `;
    await transaction`
      insert into public.entry_images(
        id,entry_id,storage_bucket,object_path,kind,alt_text,mime_type,byte_size,width,height,
        sort_order,is_primary,source_url,credit,license_name,license_url,created_by_id,deleted_at)
      values(
        ${item.imageId}::uuid,${item.entryId}::uuid,${STORAGE_BUCKET},${item.objectPath},
        'PRIMARY'::public.entry_image_kind,${item.altText},'image/webp',${image.byteSize},
        ${image.width},${image.height},0,true,${item.sourcePage},${item.author},
        ${item.licenseName},${item.licenseUrl},${SYSTEM_USER_ID}::uuid,null)
      on conflict(id) do update
      set entry_id=excluded.entry_id,
          storage_bucket=excluded.storage_bucket,
          object_path=excluded.object_path,
          kind=excluded.kind,
          alt_text=excluded.alt_text,
          mime_type=excluded.mime_type,
          byte_size=excluded.byte_size,
          width=excluded.width,
          height=excluded.height,
          sort_order=excluded.sort_order,
          is_primary=excluded.is_primary,
          source_url=excluded.source_url,
          credit=excluded.credit,
          license_name=excluded.license_name,
          license_url=excluded.license_url,
          created_by_id=excluded.created_by_id,
          deleted_at=null
    `;
  });
}

async function main(): Promise<void> {
  const unknownArguments = process.argv
    .slice(2)
    .filter((value) => !["--apply", "--help"].includes(value));
  if (unknownArguments.length > 0) throw new Error(`Argument inconnu: ${unknownArguments[0]}.`);
  if (process.argv.includes("--help")) {
    console.log(usage());
    return;
  }

  const apply = process.argv.includes("--apply");
  const verifiedSources = await fetchCommonsMetadata();
  console.log(
    `${verifiedSources.size} sources Wikimedia Commons vérifiées (existence, MIME, page, auteur et licence).`,
  );

  if (!apply) {
    for (const item of DEMO_MEDIA_MANIFEST) {
      console.log(`[dry-run] ${item.seedKey} <- ${item.commonsFileTitle} (${item.licenseName})`);
    }
    console.log(
      "Aucun téléchargement, upload Storage ou changement SQL effectué. Utiliser --apply après revue.",
    );
    return;
  }

  const configuration = readApplyConfiguration();
  const supabase = createClient(configuration.supabaseUrl, configuration.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const sql = createDatabaseClient(configuration.databaseUrl);

  try {
    for (const [index, item] of DEMO_MEDIA_MANIFEST.entries()) {
      if (index > 0) await wait(MEDIA_DOWNLOAD_SPACING_MS);
      if (await isAlreadySynchronized(sql, supabase, item)) {
        console.log(`[skipped] ${item.seedKey} -> ${item.objectPath}`);
        continue;
      }
      const source = verifiedSources.get(item.commonsFileTitle);
      if (!source) throw new Error(`Source non vérifiée: ${item.commonsFileTitle}.`);
      const image = await downloadAndConvert(source);
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(item.objectPath, image.data, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
          metadata: {
            sourcePage: item.sourcePage,
            sourceTitle: item.commonsFileTitle,
            sourceSha1: source.sourceSha1,
            sourceMime: source.sourceMime,
            sourceDimensions: `${source.sourceWidth}x${source.sourceHeight}`,
            credit: item.author,
            licenseName: item.licenseName,
            licenseUrl: item.licenseUrl,
            isIllustration: true,
            transformation: "auto-rotate; max 1600px; WebP quality 82",
          },
        });
      if (error)
        throw new Error(`Upload Storage impossible pour ${item.seedKey}: ${error.message}`);

      await associateImage(sql, item, image);
      console.log(`[applied] ${item.seedKey} -> ${item.objectPath}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Synchronisation des médias impossible.");
  process.exitCode = 1;
});
