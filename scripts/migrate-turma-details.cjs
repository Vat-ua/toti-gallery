// Explicit development/test-only migration; production is intentionally unsupported.
const fs = require('node:fs');
const { parseArgs } = require('node:util');
const { createHash } = require('node:crypto');
const { config } = require('dotenv');
const { Client } = require('pg');
const { assertDatabaseTarget } = require('../src/lib/database-target.cjs');
const { values } = parseArgs({ options: { 'env-file': { type: 'string', default: '.env.local' } } });
const loaded = config({ path: values['env-file'], override: true, quiet: true });
if (loaded.error || !['development', 'test'].includes(process.env.GALLERY_DATABASE_ENV)) throw new Error('Select an explicit development/test environment.');
const url = new URL(process.env.DATABASE_URL); url.hostname = url.hostname.replace(/-pooler\./, '.');
const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 30000 });
const digest = rows => createHash('sha256').update(JSON.stringify(rows.map(JSON.stringify).sort())).digest('hex');
async function snapshot() {
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows;
  const data = {};
  for (const { tablename } of tables) data[tablename] = (await client.query(`SELECT * FROM "${tablename}"`)).rows;
  return data;
}
(async () => {
  try {
    await client.connect(); await assertDatabaseTarget(client, process.env, process.env.GALLERY_DATABASE_ENV);
    const before = await snapshot();
    if (before.gallery_turmas.some(t => Object.hasOwn(t, 'number'))) throw new Error('Migration already applied; no changes made.');
    fs.mkdirSync('tmp/turma-refinement', { recursive: true, mode: 0o700 });
    const backup = `tmp/turma-refinement/${process.env.GALLERY_DATABASE_ENV}-before.json`;
    if (fs.existsSync(backup)) throw new Error('Review the existing backup before retrying.');
    fs.writeFileSync(backup, JSON.stringify(before), { mode: 0o600 });
    try { await client.query(fs.readFileSync('migrations/20261027_turma_details.sql', 'utf8')); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    const after = await snapshot();
    for (const table of Object.keys(before)) {
      const originalColumns = Object.keys(before[table][0] || {});
      const rows = after[table].map(row => Object.fromEntries(originalColumns.map(key => [key, row[key]])));
      if (digest(before[table]) !== digest(rows)) throw new Error(`Data preservation failed: ${table}`);
    }
    for (const turma of after.gallery_turmas) {
      if (turma.name !== `Turma ${turma.number}` || turma.course_name !== null || turma.start_year !== null) throw new Error('Unexpected turma backfill.');
    }
    const report = { environment: process.env.GALLERY_DATABASE_ENV, branch: process.env.NEON_BRANCH_ID, originalDataPreserved: true, groups: after.gallery_turmas.length, tablesChecked: Object.keys(before).length, historicalCourseAndStartYearUnknown: true };
    fs.writeFileSync(`tmp/turma-refinement/${process.env.GALLERY_DATABASE_ENV}-migration.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await client.end(); }
})().catch(error => { console.error(error.code || (!error.query && !error.detail ? error.message : 'Migration failed; connection details are not printed.')); process.exitCode = 1; });
