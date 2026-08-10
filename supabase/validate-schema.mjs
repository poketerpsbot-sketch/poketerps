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
const drizzle = read("../src/lib/db/schema.ts");

assert(schema === migration, "001_initial_schema.sql must be an exact copy of schema.sql");
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
  assert(rlsBlock.includes(`'${table}'`), `RLS enable list is missing ${table}`);
}

const categories = [
  "fleur",
  "pre-roll",
  "hash",
  "rosin",
  "extractions-solvants",
  "vape",
  "edibles",
  "medicinal",
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
  "medicinal",
  "topical",
  "solventless",
];
const demoSeedKeys = matches(schema, /'(demo\.[a-z0-9.-]+)'/g);
assert(demoSeedKeys.length === 20, `expected 20 demo seed keys, found ${demoSeedKeys.length}`);
for (const prefix of demoPrefixes) {
  const count = demoSeedKeys.filter((key) => key.startsWith(`demo.${prefix}.`)).length;
  assert(count === 2, `expected two demo entries for ${prefix}, found ${count}`);
}
const enrichmentPayload = demoEnrichmentMigration.match(/\$demo\$([\s\S]*?)\$demo\$/)?.[1];
assert(enrichmentPayload, "demo enrichment JSON payload is missing");
const enrichedDemos = JSON.parse(enrichmentPayload);
const enrichedSeedKeys = uniqueSorted(enrichedDemos.map((entry) => entry.seed_key));
assert(enrichedDemos.length === 20, `expected 20 enriched demos, found ${enrichedDemos.length}`);
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
