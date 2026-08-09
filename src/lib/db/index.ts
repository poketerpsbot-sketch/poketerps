import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { getEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

type Database = PostgresJsDatabase<typeof schema>;
type GlobalDatabase = typeof globalThis & {
  __pokedexPostgres?: Sql;
  __pokedexDatabase?: Database;
};

function createClient(): Sql {
  const env = getEnv();
  const url = new URL(env.DATABASE_URL);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  return postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: isLocal ? false : "require",
  });
}

export function getSqlClient(): Sql {
  const globalDatabase = globalThis as GlobalDatabase;
  if (!globalDatabase.__pokedexPostgres) globalDatabase.__pokedexPostgres = createClient();
  return globalDatabase.__pokedexPostgres;
}

export function getDb(): Database {
  const globalDatabase = globalThis as GlobalDatabase;
  if (!globalDatabase.__pokedexDatabase) {
    globalDatabase.__pokedexDatabase = drizzle(getSqlClient(), { schema });
  }
  return globalDatabase.__pokedexDatabase;
}

export async function checkDatabase(): Promise<void> {
  await getSqlClient()`select 1`;
}
