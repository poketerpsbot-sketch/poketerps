import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativeUrl) =>
  readFileSync(fileURLToPath(new URL(relativeUrl, import.meta.url)), "utf8");
const fail = (message) => {
  throw new Error(message);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const matches = (source, expression, group = 1) =>
  [...source.matchAll(expression)].map((match) => match[group]);
const uniqueSorted = (values) => [...new Set(values)].sort();
const difference = (left, right) => left.filter((value) => !right.includes(value));

const schema = read("./schema.sql");
const migration = read("./migrations/001_initial_schema.sql");
const demoEnrichmentMigration = read("./migrations/002_enrich_demo_entries.sql");
const contestMigration = read("./migrations/003_contests.sql");
const taxonomyMeasurementMigration = read("./migrations/004_taxonomy_measurements.sql");
const roleBadgeMigration = read("./migrations/005_role_badges.sql");
const navigationReviewsTeamMigration = read(
  "./migrations/006_navigation_reviews_contests_team_activity.sql",
);
const followupHardeningMigration = read("./migrations/007_followup_hardening.sql");
const entryManagementMigration = read("./migrations/008_entry_management_age_gate_partner_cta.sql");
const contestExperienceMigration = read(
  "./migrations/20260811231831_contest_experience_weight_stats_winner.sql",
);
const productEvolutionMigration = read(
  "./migrations/20260816090000_admin_activity_xp_badges_aromas_home.sql",
);
const badgeVisualMigration = read("./migrations/20260816193112_badge_visual_collection_v2.sql");
const drizzle = read("../src/lib/db/schema.ts");

assert(
  schema !== migration &&
    schema.includes("-- Evolution 006: avis, notifications, concours configurables"),
  "schema.sql must be the full snapshot, while 001 remains immutable",
);
const evolutionStart = "do $$ begin create type public.review_moderation_action";
const followupHeader = "-- Evolution 007: durcissement capacite des concours";
const followupStart = "create or replace function public.enforce_contest_capacity_floor()";
const entryManagementHeader = "-- Evolution 008: gestion editoriale";
const entryManagementStart =
  "alter type public.user_notification_type add value if not exists 'ENTRY_CHANGES_REQUESTED';";
const evolutionBody = (source) => {
  const start = source.lastIndexOf(evolutionStart);
  const followup = source.indexOf(`\n${followupHeader}`, start);
  const end = followup >= 0 ? followup : source.lastIndexOf("\ncommit;");
  assert(start >= 0 && end > start, "006 evolution body is missing");
  return source.slice(start, end).trimEnd();
};
assert(
  evolutionBody(schema)
    .replace(",'ENTRY_CHANGES_REQUESTED','CONTEST_NEW','CONTEST_RESULT','CONTEST_WINNER'", "")
    .replace(",'WEIGHT_GUESS'", "") === evolutionBody(navigationReviewsTeamMigration),
  "schema.sql evolution 006 mirror is out of sync with its migration",
);
const followupBody = (source) => {
  const start = source.lastIndexOf(followupStart);
  const next = source.indexOf(`\n${entryManagementHeader}`, start);
  const end = next >= 0 ? next : source.lastIndexOf("\ncommit;");
  assert(start >= 0 && end > start, "007 evolution body is missing");
  return source.slice(start, end).trimEnd();
};
assert(
  schema.includes(followupHeader) &&
    followupBody(schema) === followupBody(followupHardeningMigration),
  "schema.sql evolution 007 mirror is out of sync with its migration",
);
const entryManagementBody = (source) => {
  const start = source.lastIndexOf(entryManagementStart);
  const contestExperience = source.indexOf("\n-- Evolution 009:", start);
  const end = contestExperience >= 0 ? contestExperience : source.lastIndexOf("\ncommit;");
  assert(start >= 0 && end > start, "008 evolution body is missing");
  return source
    .slice(start, end)
    .replace(
      /\nbegin;\nset local lock_timeout = '10s';\nset local statement_timeout = '0';\nset local search_path = public, extensions, pg_temp;\n/,
      "\n",
    )
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n")
    .trimEnd();
};
assert(
  schema.includes(entryManagementHeader) &&
    entryManagementBody(schema) === entryManagementBody(entryManagementMigration),
  "schema.sql evolution 008 mirror is out of sync with its migration",
);
const contestExperienceHeader =
  "-- Evolution 009: experience concours, jeu du poids, statistiques, gagnants et diffusion.";
const contestExperienceStart = "do $$ begin\n  create type public.contest_link_type as enum";
const productEvolutionHeader =
  "-- Evolution sessions, XP, badges, aromes et accueil (migration 20260816090000).";
const contestExperienceBody = (source) => {
  const start = source.lastIndexOf(contestExperienceStart);
  const productEvolution = source.indexOf(`\n${productEvolutionHeader}`, start);
  const end = productEvolution >= 0 ? productEvolution : source.lastIndexOf("\ncommit;");
  assert(start >= 0 && end > start, "009 evolution body is missing");
  return source.slice(start, end).trimEnd();
};
assert(
  schema.includes(contestExperienceHeader) &&
    contestExperienceBody(schema) === contestExperienceBody(contestExperienceMigration),
  "schema.sql evolution 009 mirror is out of sync with its migration",
);
const productEvolutionStart = "-- Une session logique de navigateur";
const badgeVisualHeader = "-- Evolution visuelle badges V2 (migration 20260816193112).";
const productEvolutionBody = (source) => {
  const start = source.lastIndexOf(productEvolutionStart);
  const badgeVisual = source.indexOf(`\n${badgeVisualHeader}`, start);
  const end = badgeVisual >= 0 ? badgeVisual : source.lastIndexOf("\ncommit;");
  assert(start >= 0 && end > start, "product evolution body is missing");
  return source.slice(start, end).trimEnd();
};
assert(
  schema.includes(productEvolutionHeader) &&
    productEvolutionBody(schema) === productEvolutionBody(productEvolutionMigration),
  "schema.sql product evolution mirror is out of sync with its migration",
);
const badgeVisualUrls = matches(badgeVisualMigration, /then '(\/badges\/v2\/[^']+)'/g);
assert(schema.includes(badgeVisualHeader), "schema.sql badge visual V2 snapshot is missing");
assert(
  badgeVisualUrls.length === 19 && uniqueSorted(badgeVisualUrls).length === 19,
  "badge visual migration must map 19 unique assets",
);
assert(
  (badgeVisualMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (badgeVisualMigration.match(/^commit;$/gm) ?? []).length === 1,
  "badge visual migration must contain one transaction",
);
assert((schema.match(/^begin;$/gm) ?? []).length === 1, "schema must contain exactly one BEGIN");
assert((schema.match(/^commit;$/gm) ?? []).length === 1, "schema must contain exactly one COMMIT");
assert(schema.trimEnd().endsWith("commit;"), "schema transaction must end with COMMIT");
assert((schema.match(/\$\$/g) ?? []).length % 2 === 0, "unbalanced dollar-quoted delimiters");
assert(
  (demoEnrichmentMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (demoEnrichmentMigration.match(/^commit;$/gm) ?? []).length === 1,
  "002_enrich_demo_entries.sql must contain one transaction",
);
assert(
  (demoEnrichmentMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in demo enrichment migration",
);
assert(
  (contestMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (contestMigration.match(/^commit;$/gm) ?? []).length === 1,
  "003_contests.sql must contain one transaction",
);
assert(
  (contestMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in contest migration",
);
assert(
  (taxonomyMeasurementMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (taxonomyMeasurementMigration.match(/^commit;$/gm) ?? []).length === 1,
  "004_taxonomy_measurements.sql must contain one transaction",
);
assert(
  (taxonomyMeasurementMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in taxonomy measurement migration",
);
assert(
  (roleBadgeMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (roleBadgeMigration.match(/^commit;$/gm) ?? []).length === 1,
  "005_role_badges.sql must contain one transaction",
);
assert(
  (navigationReviewsTeamMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (navigationReviewsTeamMigration.match(/^commit;$/gm) ?? []).length === 1,
  "006_navigation_reviews_contests_team_activity.sql must contain one main transaction",
);
assert(
  (navigationReviewsTeamMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in navigation/reviews/team migration",
);
assert(
  (followupHardeningMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (followupHardeningMigration.match(/^commit;$/gm) ?? []).length === 1,
  "007_followup_hardening.sql must contain one transaction",
);
assert(
  (followupHardeningMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in follow-up hardening migration",
);
assert(
  (entryManagementMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (entryManagementMigration.match(/^commit;$/gm) ?? []).length === 1,
  "008_entry_management_age_gate_partner_cta.sql must contain one transaction",
);
assert(
  (entryManagementMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in entry management migration",
);
assert(
  (contestExperienceMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (contestExperienceMigration.match(/^commit;$/gm) ?? []).length === 1,
  "009 contest experience migration must contain one transaction",
);
assert(
  (contestExperienceMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in contest experience migration",
);
assert(
  (productEvolutionMigration.match(/^begin;$/gm) ?? []).length === 1 &&
    (productEvolutionMigration.match(/^commit;$/gm) ?? []).length === 1,
  "product evolution migration must contain one transaction",
);
assert(
  (productEvolutionMigration.match(/\$\$/g) ?? []).length % 2 === 0,
  "unbalanced delimiters in product evolution migration",
);

const sqlTables = uniqueSorted(matches(schema, /create table if not exists public\.([a-z0-9_]+)/g));
const drizzleTables = uniqueSorted(matches(drizzle, /pgTable\(\s*["']([a-z0-9_]+)["']/g));
const sqlEnums = uniqueSorted(matches(schema, /create type public\.([a-z0-9_]+) as enum/g));
const drizzleEnums = uniqueSorted(matches(drizzle, /pgEnum\(["']([a-z0-9_]+)["']/g));

assert(
  difference(sqlTables, drizzleTables).length === 0 &&
    difference(drizzleTables, sqlTables).length === 0,
  `SQL/Drizzle table mismatch: SQL-only=${difference(sqlTables, drizzleTables).join(",")}; Drizzle-only=${difference(drizzleTables, sqlTables).join(",")}`,
);
assert(
  difference(sqlEnums, drizzleEnums).length === 0 &&
    difference(drizzleEnums, sqlEnums).length === 0,
  `SQL/Drizzle enum mismatch: SQL-only=${difference(sqlEnums, drizzleEnums).join(",")}; Drizzle-only=${difference(drizzleEnums, sqlEnums).join(",")}`,
);

const sqlEnumValues = new Map(
  [...schema.matchAll(/create type public\.([a-z0-9_]+) as enum\s*\(([\s\S]*?)\)/g)].map(
    (match) => [match[1], matches(match[2], /'([^']+)'/g)],
  ),
);
for (const match of schema.matchAll(
  /alter type public\.([a-z0-9_]+) add value if not exists '([^']+)'/g,
)) {
  const values = sqlEnumValues.get(match[1]) ?? [];
  if (!values.includes(match[2])) values.push(match[2]);
  sqlEnumValues.set(match[1], values);
}
const drizzleEnumValues = new Map(
  [...drizzle.matchAll(/pgEnum\(\s*["']([a-z0-9_]+)["']\s*,\s*\[([\s\S]*?)\]\s*\)/g)].map(
    (match) => [match[1], matches(match[2], /["']([^"']+)["']/g)],
  ),
);
for (const enumName of sqlEnums) {
  const sqlValues = sqlEnumValues.get(enumName) ?? [];
  const drizzleValues = drizzleEnumValues.get(enumName) ?? [];
  assert(
    JSON.stringify(sqlValues) === JSON.stringify(drizzleValues),
    `${enumName} value mismatch: SQL=${sqlValues.join(",")}; Drizzle=${drizzleValues.join(",")}`,
  );
}

const functionStatements = schema.match(/create or replace function[\s\S]*?\$\$;/gi) ?? [];
const definers = functionStatements.filter((statement) => /security definer/i.test(statement));
assert(definers.length > 0, "expected SECURITY DEFINER functions");
for (const statement of definers) {
  const name = statement.match(/function\s+public\.([a-z0-9_]+)/i)?.[1] ?? "unknown";
  assert(/set\s+search_path\s*=\s*''/i.test(statement), `${name} has no empty search_path`);
}

const viewStatements = schema.match(/create or replace view[\s\S]*?;/gi) ?? [];
assert(viewStatements.length > 0, "expected public views");
for (const statement of viewStatements) {
  const name = statement.match(/view\s+public\.([a-z0-9_]+)/i)?.[1] ?? "unknown";
  assert(/security_invoker\s*=\s*true/i.test(statement), `${name} is not security_invoker`);
}

assert(
  /revoke execute on all functions in schema public from public,anon,authenticated;/i.test(schema),
  "PUBLIC/anon/authenticated function EXECUTE revoke is missing",
);
assert(
  /grant execute on all functions in schema public to service_role;/i.test(schema),
  "service_role function EXECUTE grant is missing",
);
assert(
  !/grant\s+(insert|update|delete|all)[\s\S]{0,200}\s+to\s+(anon|authenticated)/i.test(schema),
  "client write privilege found",
);
const policies = schema.match(/create policy[\s\S]*?;/gi) ?? [];
assert(
  policies.every((policy) => /for select/i.test(policy)),
  "non-SELECT client RLS policy found",
);
assert(
  policies.every((policy) => !/on storage\.objects/i.test(policy)),
  "Storage client policy found",
);

const rlsBlock = schema.match(/-- RLS defaults[\s\S]*?end \$\$;/i)?.[0] ?? "";
for (const table of sqlTables) {
  assert(
    rlsBlock.includes(`'${table}'`) ||
      new RegExp(`alter table public\\.${table} enable row level security`, "i").test(schema),
    `RLS enable coverage is missing ${table}`,
  );
}

const categories = [
  "fleur",
  "pre-roll",
  "hash",
  "rosin",
  "extractions-solvants",
  "vape",
  "edibles",
  "topiques",
  "concentres-sans-solvant",
];
for (const category of categories) {
  assert(schema.includes(`('${category}',`), `category seed is missing ${category}`);
}

const demoPrefixes = [
  "flower",
  "pre-roll",
  "hash",
  "rosin",
  "solvent",
  "vape",
  "edibles",
  "topical",
  "solventless",
];
const demoSeedKeys = matches(schema, /'(demo\.[a-z0-9.-]+)'/g);
assert(demoSeedKeys.length === 18, `expected 18 demo seed keys, found ${demoSeedKeys.length}`);
for (const prefix of demoPrefixes) {
  const count = demoSeedKeys.filter((key) => key.startsWith(`demo.${prefix}.`)).length;
  assert(count === 2, `expected two demo entries for ${prefix}, found ${count}`);
}
const enrichmentPayload = demoEnrichmentMigration.match(/\$demo\$([\s\S]*?)\$demo\$/)?.[1];
assert(enrichmentPayload, "demo enrichment JSON payload is missing");
const enrichedDemos = JSON.parse(enrichmentPayload);
const enrichedSeedKeys = uniqueSorted(enrichedDemos.map((entry) => entry.seed_key));
assert(enrichedDemos.length === 18, `expected 18 enriched demos, found ${enrichedDemos.length}`);
assert(
  JSON.stringify(enrichedSeedKeys) === JSON.stringify(uniqueSorted(demoSeedKeys)),
  "demo enrichment seed keys do not match the initial demo catalogue",
);
assert(
  enrichedDemos.every(
    (entry) =>
      entry.short_description?.length >= 80 &&
      entry.full_description?.includes("\n\n") &&
      entry.declared_variety &&
      entry.declared_producer &&
      entry.method &&
      entry.texture &&
      Object.keys(entry.fields ?? {}).length >= 3,
  ),
  "demo descriptions or declared fields are incomplete",
);
assert(
  /where e\.seed_key=content\.seed_key and e\.is_demo/i.test(demoEnrichmentMigration) &&
    /on conflict\(entry_id,field_definition_id\) do update/i.test(demoEnrichmentMigration),
  "demo enrichment must stay guarded and idempotent",
);
assert(!schema.includes("('medicinal',"), "fresh taxonomy must not seed the medicinal category");
assert(
  /seed_key in \('demo\.medicinal\.oil', 'demo\.medicinal\.capsules'\)/i.test(
    taxonomyMeasurementMigration,
  ) &&
    /status = 'DELETED'::public\.entry_status/i.test(taxonomyMeasurementMigration) &&
    /where slug = 'medicinal'/i.test(taxonomyMeasurementMigration),
  "004 must soft-delete the old medicinal category and its two demo entries",
);
assert(
  /create temporary table if not exists pokedex_expected_measurement_fields/i.test(
    taxonomyMeasurementMigration,
  ) &&
    /on conflict do nothing/i.test(taxonomyMeasurementMigration) &&
    /measurement taxonomy is incomplete/i.test(taxonomyMeasurementMigration),
  "004 measurement taxonomy must stay idempotent and self-validating",
);
for (const unit of ["g", "mg/g", "%", "mL", "mg/mL", "unité(s)", "mg/unité", "mg/emballage"]) {
  assert(schema.includes(`'${unit}'`), `measurement unit is missing ${unit}`);
}
assert(!/'ml'/.test(schema), "invalid lowercase ml unit remains in fresh schema");
assert(
  /entry_images_attribution_consistency/i.test(schema) &&
    /sourceUrl: text\("source_url"\)/.test(drizzle),
  "image attribution columns are missing from SQL or Drizzle",
);
assert(
  /\('entry-drafts','entry-drafts',false,/i.test(schema),
  "private entry-drafts Storage bucket is missing",
);
assert(
  /\('message-attachments','message-attachments',false,/i.test(schema),
  "private message-attachments Storage bucket is missing",
);
assert(schema.includes("('badge.manage',"), "badge.manage permission seed is missing");
assert(schema.includes("('contest.manage',"), "contest.manage permission seed is missing");
assert(schema.includes("('contest.moderate',"), "contest.moderate permission seed is missing");
assert(
  /\('MODERATOR','contest\.moderate'\)/.test(schema) &&
    /\('MODERATOR','entry\.moderate'\)/.test(schema),
  "moderator contest/entry permissions are missing",
);
assert(
  /contest_winners_participation_contest_fk[\s\S]*references public\.contest_participations\(id,contest_id\)/i.test(
    schema,
  ),
  "contest winner must reference a participation from the same contest",
);
assert(
  /create policy public_contests_read[\s\S]*for select to anon,authenticated/i.test(schema) &&
    /create policy public_contest_participations_read[\s\S]*status='APPROVED'/i.test(schema),
  "public contest RLS policies are missing or too broad",
);
assert(
  /create or replace function public\.award_contest_winner_badge\(\)[\s\S]*security definer set search_path=''/i.test(
    schema,
  ) &&
    /revoke execute on function public\.award_contest_winner_badge\(\) from public,anon,authenticated/i.test(
      schema,
    ),
  "automatic contest badge function is not secured",
);
assert(
  /create table if not exists public\.contests/i.test(contestMigration) &&
    /drop policy if exists public_contests_read/i.test(contestMigration) &&
    /on conflict\(code\) do update/i.test(contestMigration),
  "003_contests.sql must remain idempotent",
);
assert(
  /account_kind='SYSTEM'[\s\S]*telegram_id is null/i.test(schema),
  "system-account identity guard missing",
);
assert(
  /and e\.deleted_at is null and e\.published_at is not null and not e\.is_demo/i.test(schema),
  "demo entries are not excluded from trainer rankings",
);
assert(
  /where u\.account_kind='TELEGRAM' and not u\.is_system/i.test(schema),
  "system users are not excluded from trainer rankings",
);
assert(
  /new\.source_type='ENTRY'[\s\S]*e\.is_demo/i.test(schema),
  "demo entries are not excluded from XP",
);

const micronPresets = [
  "15-um",
  "25-um",
  "37-um",
  "45-um",
  "73-um",
  "90-um",
  "120-um",
  "150-um",
  "160-um",
  "190-um",
  "220-um",
  "45-73-um",
  "73-90-um",
  "90-119-um",
  "90-120-um",
  "45-159-um",
  "73-159-um",
  "full-spectrum",
  "mixed-micron",
  "not-specified",
];
for (const preset of micronPresets) {
  assert(schema.includes(`('${preset}',`), `micron preset is missing ${preset}`);
}

assert(
  /create table if not exists public\.telegram_update_receipts[\s\S]*?update_id bigint primary key/i.test(
    schema,
  ),
  "telegram_update_receipts idempotency table is missing",
);
assert(
  /delete from public\.telegram_update_receipts[\s\S]*status in \('PROCESSED','FAILED'\)/i.test(
    schema,
  ),
  "telegram update receipt cleanup is missing",
);

console.log(
  `Schema guard passed: ${sqlTables.length} tables, ${sqlEnums.length} enums, ${definers.length} SECURITY DEFINER functions, ${demoSeedKeys.length} demo entries.`,
);
