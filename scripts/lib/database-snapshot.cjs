const { createHash } = require("node:crypto");
const tables = ["gallery_users", "gallery_projects", "gallery_project_authors", "gallery_sessions", "gallery_likes"];
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const fingerprint = rows => createHash("sha256").update(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())).digest("hex");

async function snapshot(client) {
  const result = {};
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    for (const table of tables) {
      const columns = (await client.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table])).rows;
      if (!columns.length) throw new Error(`Missing expected legacy source table: ${table}`);
      result[table] = { columns, rows: (await client.query(`SELECT * FROM ${quote(table)}`)).rows };
    }
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}

function fingerprints(data) { return Object.fromEntries(tables.map(table => [table, fingerprint(data[table].rows)])); }

async function copyRows(target, source) {
  for (const table of tables) {
    const { columns, rows } = source[table];
    for (const row of rows) {
      const values = columns.map(c => ["json", "jsonb"].includes(c.data_type) ? JSON.stringify(row[c.column_name]) : row[c.column_name]);
      await target.query(`INSERT INTO ${quote(table)} (${columns.map(c => quote(c.column_name)).join(",")}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")})`, values);
    }
  }
}

module.exports = { tables, quote, snapshot, fingerprint, fingerprints, copyRows };
