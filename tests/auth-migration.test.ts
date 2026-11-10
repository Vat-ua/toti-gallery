import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { config, parse } from "dotenv";
import { Client } from "pg";
import { assertRuntimeTarget, assertDatabaseTarget } from "../src/lib/database-target.cjs";

// Historical cutover acceptance only. Requires the original prepared snapshot
// and its read-only source; never runs in the current-schema CI runner.
let pool: typeof import("../src/db").pool;
before(async () => {
  const loaded = config({ path: process.env.AUTH_TEST_ENV_FILE || ".env.auth-test", override: true, quiet: true });
  assert.ok(!loaded.error, "Prepare the historical isolated migration fixture first");
  assert.match(process.env.AUTH_TEST_DATABASE_NAME || "", /^gallery_auth_test_\d+_[a-f0-9]{8}$/);
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/" + process.env.AUTH_TEST_DATABASE_NAME);
  delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  delete process.env.VERCEL_ENV;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  ({ pool } = await import("../src/db"));
  await assertDatabaseTarget(pool, process.env, "test");
});

test("the migrated database matches the canonical schema and keeps demo content", async () => {
  const client = await pool.connect();
  try {
    const { schemaContract } = await import("../scripts/lib/schema-contract.cjs");
    const exported = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export", "--dialect=postgresql", "--schema=./src/db/schema.ts"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    await client.query("CREATE SCHEMA auth_contract");
    await client.query("SET search_path TO auth_contract");
    await client.query(exported.slice(exported.indexOf("CREATE TABLE")).replaceAll('"public".', '"auth_contract".'));
    await client.query("SET search_path TO public");
    const actual = await schemaContract(client, "public");
    const expected = await schemaContract(client, "auth_contract");
    assert.deepEqual(actual, expected);
    const source = JSON.parse(readFileSync("tmp/auth-review/database-report.json", "utf8"));
    const counts = (await client.query(`SELECT
      (SELECT count(*)::int FROM gallery_projects) AS projects,
      (SELECT count(*)::int FROM gallery_project_authors) AS authors,
      (SELECT count(*)::int FROM gallery_users WHERE is_demo) AS demos`)).rows[0];
    assert.equal(counts.projects, source.sourceCounts.gallery_projects);
    assert.equal(counts.authors, source.sourceCounts.gallery_project_authors);
    assert.equal(counts.demos, source.sourceCounts.gallery_users);
  } finally { await client.query("SET search_path TO public"); await client.query("DROP SCHEMA IF EXISTS auth_contract CASCADE"); client.release(); }
});

after(async () => {
  if (!pool) return;
  try {
    const { snapshot, fingerprints } = await import("../scripts/lib/database-snapshot.cjs");
    const sourceEnv = parse(readFileSync(".env.test-source"));
    assertRuntimeTarget(sourceEnv.DATABASE_URL, sourceEnv);
    const source = new Client({ connectionString: sourceEnv.DATABASE_URL });
    await source.connect();
    try {
      await assertDatabaseTarget(source, sourceEnv, "test");
      // snapshot() opens its own repeatable-read, read-only transaction.
      const initial = JSON.parse(readFileSync("tmp/auth-review/database-report.json", "utf8"));
      assert.deepEqual(fingerprints(await snapshot(source)), initial.sourceFingerprints, "Source database changed since preparation");
    } finally { await source.end(); }
  } finally { await pool.end(); }
});
