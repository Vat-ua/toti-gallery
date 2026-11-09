import type { PoolClient } from "pg";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../src/db/schema";
import { assertDatabaseTarget } from "../../src/lib/database-target.cjs";

/** Caller owns the transaction. Refuse to reset or schema-push a populated DB. */
export async function createCurrentTestSchema(client: PoolClient) {
  await assertDatabaseTarget(client, process.env, "test");
  const existing = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' LIMIT 1");
  if (existing.rowCount) throw new Error("Test setup requires an empty disposable database; existing data will not be reset.");
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  for (const statement of statements) await client.query(statement);
}
