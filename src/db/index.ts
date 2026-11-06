import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { assertRuntimeTarget } from "@/lib/database-target.cjs";
import { createDatabasePool } from "@/lib/database-pool";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

assertRuntimeTarget(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  createDatabasePool(databaseUrl);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
