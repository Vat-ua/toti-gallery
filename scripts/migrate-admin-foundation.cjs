// Stage 3 part 1 only: development or a verified isolated test branch.
const fs = require("node:fs");
const { parseArgs } = require("node:util");
const { createHash } = require("node:crypto");
const { config } = require("dotenv");
const { Client } = require("pg");
const { assertDatabaseTarget } = require("../src/lib/database-target.cjs");
const { values } = parseArgs({ options: { "env-file": { type: "string", default: ".env.local" }, "owner-id": { type: "string" } } });
const loaded = config({ path: values["env-file"], override: true, quiet: true });
if (loaded.error || !values["owner-id"] || !["development", "test"].includes(process.env.GALLERY_DATABASE_ENV)) throw new Error("Use an explicit development/test env file and --owner-id EXISTING_ADMIN_ID.");
const url = new URL(process.env.DATABASE_URL);
url.hostname = url.hostname.replace(/-pooler\./, ".");
const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 30000 });
const digest = rows => createHash("sha256").update(JSON.stringify(rows.map(JSON.stringify).sort())).digest("hex");
async function snapshot() {
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows;
  const result = {};
  for (const { tablename } of tables) result[tablename] = (await client.query(`SELECT * FROM "${tablename}"`)).rows;
  return result;
}
(async () => {
  try {
    await client.connect();
    await assertDatabaseTarget(client, process.env, process.env.GALLERY_DATABASE_ENV);
    const before = await snapshot();
    const owner = before.gallery_users.find(u => u.id === values["owner-id"]);
    if (!owner || owner.is_demo || owner.status !== "active" || owner.role !== "admin") throw new Error("Selected ID is not an active, non-demo administrator. No migration applied.");
    fs.mkdirSync("tmp/admin-review", { recursive: true, mode: 0o700 });
    const backup = `tmp/admin-review/${process.env.GALLERY_DATABASE_ENV}-before-owner.json`;
    if (fs.existsSync(backup)) throw new Error("An earlier backup exists. Review it before retrying.");
    fs.writeFileSync(backup, JSON.stringify(before), { mode: 0o600 });
    await client.query("SELECT set_config('gallery.owner_user_id',$1,false)", [owner.id]);
    try { await client.query(fs.readFileSync("migrations/20261027_stage3_owner.sql", "utf8")); }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    const after = await snapshot();
    const ownerAfter = after.gallery_users.find(u => u.id === owner.id);
    if (ownerAfter?.role !== "owner") throw new Error("Owner migration did not promote the selected ID.");
    // Only the explicitly approved role transition may differ.
    const normalized = { ...after, gallery_users: after.gallery_users.map(u => u.id === owner.id ? { ...u, role: "admin" } : u) };
    for (const table of Object.keys(before)) if (digest(before[table]) !== digest(normalized[table])) throw new Error(`Data preservation comparison failed: ${table}`);
    const report = { environment: process.env.GALLERY_DATABASE_ENV, branch: process.env.NEON_BRANCH_ID, ownerId: owner.id, ownerRole: ownerAfter.role, allOtherDataPreserved: true, tablesChecked: Object.keys(before).length };
    fs.writeFileSync(`tmp/admin-review/${process.env.GALLERY_DATABASE_ENV}-migration.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await client.end(); }
})().catch(error => { console.error(error.code || (error instanceof Error && !error.query && !error.detail ? error.message : "Migration failed; connection details are not printed.")); process.exitCode = 1; });
