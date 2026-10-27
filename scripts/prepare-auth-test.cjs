const fs = require("node:fs");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { parse } = require("dotenv");
const { Client } = require("pg");
const { assertRuntimeTarget, assertDatabaseTarget } = require("../src/lib/database-target.cjs");
const { tables, quote, snapshot, fingerprint, fingerprints, copyRows } = require("./lib/database-snapshot.cjs");

(async () => {
  const sourceFile = ".env.test-source";
  const sourceEnv = parse(fs.readFileSync(sourceFile));
  assert.ok(!fs.existsSync(".env.auth-test") || !parse(fs.readFileSync(".env.auth-test")).DATABASE_URL, "An auth test database is already configured; select a new temporary branch explicitly.");
  const sourceUrl = sourceEnv.DATABASE_URL;
  assertRuntimeTarget(sourceUrl, sourceEnv);
  assert.equal(sourceEnv.GALLERY_DATABASE_ENV, "test", "Use a temporary test branch, never development or production");
  const name = `gallery_auth_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const targetUrl = new URL(sourceUrl); targetUrl.pathname = "/" + name;
  assert.notEqual(targetUrl.pathname, new URL(sourceUrl).pathname);
  const source = new Client({ connectionString: sourceUrl });
  const target = new Client({ connectionString: targetUrl.toString() });
  let created = false, connected = false, ready = false;
  const report = { database: name, sourceUnchanged: false, contentPreserved: false };
  await source.connect();
  try {
    await assertDatabaseTarget(source, sourceEnv, "test");
    const before = await snapshot(source);
    report.sourceFingerprints = fingerprints(before);
    report.sourceCounts = Object.fromEntries(tables.map(table => [table, before[table].rows.length]));
    await source.query(`CREATE DATABASE ${quote(name)}`); created = true;
    await target.connect(); connected = true;
    assert.equal((await target.query("SELECT current_database() AS name")).rows[0].name, name);
    await target.query(fs.readFileSync("migrations/fixtures/legacy-schema.sql", "utf8"));
    await copyRows(target, before);
    await target.query(fs.readFileSync("migrations/20261026_stage1_platform_foundation.sql", "utf8"));
    await target.query(fs.readFileSync("migrations/20261026_stage2_auth_cutover.sql", "utf8"));
    for (const table of tables.filter(table => table !== "gallery_sessions")) {
      const columns = before[table].columns.filter(column => column.column_name !== "password_hash");
      const actual = (await target.query(`SELECT ${columns.map(c => quote(c.column_name)).join(",")} FROM ${quote(table)}`)).rows;
      const expected = before[table].rows.map(row => Object.fromEntries(columns.map(c => [c.column_name, row[c.column_name]])));
      assert.equal(fingerprint(actual), fingerprint(expected), `Content changed in ${table}`);
    }
    assert.equal((await target.query("SELECT count(*)::int AS n FROM gallery_users WHERE NOT is_demo")).rows[0].n, 0);
    assert.equal((await target.query("SELECT count(*)::int AS n FROM gallery_auth_accounts")).rows[0].n, 0);
    assert.equal((await target.query("SELECT to_regclass('gallery_sessions') AS name")).rows[0].name, null);
    report.contentPreserved = true;
    report.sourceUnchanged = JSON.stringify(report.sourceFingerprints) === JSON.stringify(fingerprints(await snapshot(source)));
    assert.ok(report.sourceUnchanged, "Source rows changed since the read-only snapshot");
    fs.writeFileSync(".env.auth-test", `DATABASE_URL=${targetUrl.toString()}\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nBETTER_AUTH_URL=http://localhost:3101\nAUTH_TEST_DATABASE_NAME=${name}\nDATABASE_NAME=${name}\nGALLERY_DATABASE_ENV=test\nNEON_PROJECT_ID=${sourceEnv.NEON_PROJECT_ID}\nNEON_BRANCH_ID=${sourceEnv.NEON_BRANCH_ID}\nNEON_ENDPOINT_ID=${sourceEnv.NEON_ENDPOINT_ID}\n`, { mode: 0o600 });
    ready = true;
    console.log("Authentication fixture database prepared inside the selected test branch. Development and production are unchanged.");
  } finally {
    if (connected) await target.end();
    if (created && !ready) await source.query(`DROP DATABASE ${quote(name)} WITH (FORCE)`);
    await source.end();
    fs.mkdirSync("tmp/auth-review", { recursive: true });
    fs.writeFileSync("tmp/auth-review/database-report.json", JSON.stringify(report, null, 2) + "\n");
  }
})().catch(error => { console.error(error.code || error.message || "Authentication test database preparation failed"); process.exitCode = 1; });
