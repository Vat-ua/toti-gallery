// Explicit development/test migration. Never selects or alters production.
const fs = require("node:fs");
const { parseArgs } = require("node:util");
const { createHash } = require("node:crypto");
const { config } = require("dotenv");
const { Client } = require("pg");
const { assertDatabaseTarget } = require("../src/lib/database-target.cjs");
const { values } = parseArgs({ options: { "env-file": { type: "string", default: ".env.local" }, framing: { type: "boolean", default: false } } });
const expectedColumns = values.framing ? ["gallery_projects.cover_framing"] : ["gallery_users.avatar_metadata", "gallery_projects.image_metadata"];
const migrationFile = values.framing ? "migrations/20261028_cover_framing.sql" : "migrations/20261028_image_storage.sql";
const loaded = config({ path: values["env-file"], override: true, quiet: true });
if (loaded.error || !["development", "test"].includes(process.env.GALLERY_DATABASE_ENV)) throw new Error("Select an explicit development/test environment.");
const url = new URL(process.env.DATABASE_URL); url.hostname = url.hostname.replace(/-pooler\./, ".");
const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 30000 });
const digest = rows => createHash("sha256").update(JSON.stringify(rows.map(JSON.stringify).sort())).digest("hex");
async function snapshot() {
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows;
  const data = {};
  for (const { tablename } of tables) data[tablename] = (await client.query(`SELECT * FROM "${tablename}"`)).rows;
  return data;
}
(async () => {
  try {
    await client.connect();
    await assertDatabaseTarget(client, process.env, process.env.GALLERY_DATABASE_ENV);
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name || '.' || column_name = ANY($1::text[])", [expectedColumns])).rows;
    if (columns.length === expectedColumns.length) { await client.query("ROLLBACK"); console.log("Selected image migration already applied; no changes made."); return; }
    if (columns.length) throw new Error("Partial image migration detected; review before proceeding.");
    const before = await snapshot();
    fs.mkdirSync("tmp/object-storage", { recursive: true, mode: 0o700 });
    const backup = `tmp/object-storage/${process.env.NEON_BRANCH_ID}-${Date.now()}-before.private.json`;
    fs.writeFileSync(backup, JSON.stringify(before), { mode: 0o600 });
    const migration = fs.readFileSync(migrationFile, "utf8").replace(/^BEGIN;\s*/m, "").replace(/^COMMIT;\s*/m, "");
    await client.query(migration);
    const after = await snapshot();
    for (const table of Object.keys(before)) {
      const originalColumns = Object.keys(before[table][0] || {});
      const rows = after[table].map(row => Object.fromEntries(originalColumns.map(key => [key, row[key]])));
      if (digest(before[table]) !== digest(rows)) throw new Error(`Data preservation failed: ${table}`);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ environment: process.env.GALLERY_DATABASE_ENV, branch: process.env.NEON_BRANCH_ID,
      originalDataPreserved: true, tablesChecked: Object.keys(before).length, addedNullableColumns: expectedColumns.length }));
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { await client.end(); }
})().catch(error => { console.error(error.code || (!error.query && !error.detail ? error.message : "Image migration failed; connection details are not printed.")); process.exitCode = 1; });
