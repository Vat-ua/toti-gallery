// Public Neon resource identifiers, never connection credentials.
const PRODUCTION = Object.freeze({
  projectId: "solitary-voice-43626583",
  branchId: "br-empty-resonance-b805h6hx",
  endpointId: "ep-wandering-wind-b8wg9taw",
  database: "toti_gallery",
});
const endpointId = value => new URL(value).hostname.split(".")[0].replace(/-pooler$/, "");

function assertLocalTestTarget(url, env) {
  const target = new URL(url);
  const database = decodeURIComponent(target.pathname.slice(1));
  if (env.GALLERY_DATABASE_ENV !== "test" || env.VERCEL_ENV || env.GALLERY_ALLOW_PRODUCTION_DATABASE
    || !["postgres:", "postgresql:"].includes(target.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
    || target.search || target.hash || !/^gallery_test_[a-z0-9_]+$/.test(database) || env.DATABASE_NAME !== database) {
    throw new Error("Local tests require an explicit loopback gallery_test_* database, without URL overrides or production context.");
  }
}

function assertRuntimeTarget(url, env = process.env) {
  if (env.GALLERY_LOCAL_TEST_DATABASE === "1") { assertLocalTestTarget(url, env); return; }
  const endpoint = endpointId(url);
  const database = decodeURIComponent(new URL(url).pathname.slice(1));
  if (env.VERCEL_ENV === "production" || env.GALLERY_ALLOW_PRODUCTION_DATABASE === "1") {
    if (endpoint !== PRODUCTION.endpointId || database !== PRODUCTION.database) throw new Error("Production database target does not match the configured platform.");
    return;
  }
  if (endpoint === PRODUCTION.endpointId || env.NEON_BRANCH_ID === PRODUCTION.branchId) throw new Error("Local runtime and tests cannot use the production database. Use the development branch.");
  if (!["development", "test"].includes(env.GALLERY_DATABASE_ENV) || !env.NEON_BRANCH_ID || env.NEON_PROJECT_ID !== PRODUCTION.projectId || env.NEON_ENDPOINT_ID !== endpoint || env.DATABASE_NAME !== database) throw new Error("Configure an explicit development/test database target; see docs/environments.md.");
}

async function assertDatabaseTarget(client, env = process.env, purpose = "test") {
  if (env.GALLERY_LOCAL_TEST_DATABASE === "1") {
    assertLocalTestTarget(env.DATABASE_URL, env);
    if (purpose !== "test") throw new Error("Local test databases cannot be used for development or production operations.");
    const row = (await client.query("SELECT current_database() AS database, current_setting('neon.project_id',true) AS project_id, current_setting('neon.branch_id',true) AS branch_id, current_setting('neon.endpoint_id',true) AS endpoint_id")).rows[0];
    if (row.database !== env.DATABASE_NAME || row.project_id || row.branch_id || row.endpoint_id) throw new Error("Local test target does not match, or connects to Neon. No writes allowed.");
    return row;
  }
  if (!["development", "test", "operations"].includes(purpose) || env.GALLERY_DATABASE_ENV !== purpose || !env.DATABASE_NAME || !env.NEON_PROJECT_ID || !env.NEON_BRANCH_ID || !env.NEON_ENDPOINT_ID) throw new Error("An explicit database environment and resource identity are required.");
  const row = (await client.query("SELECT current_database() AS database, current_setting('neon.project_id',true) AS project_id, current_setting('neon.branch_id',true) AS branch_id, current_setting('neon.endpoint_id',true) AS endpoint_id")).rows[0];
  if (row.project_id !== PRODUCTION.projectId || row.project_id !== env.NEON_PROJECT_ID || row.branch_id !== env.NEON_BRANCH_ID || row.endpoint_id !== env.NEON_ENDPOINT_ID || row.database !== env.DATABASE_NAME) throw new Error("Connected Neon branch/endpoint/database does not match the selected environment. No writes allowed.");
  if (purpose !== "operations" && row.branch_id === PRODUCTION.branchId) throw new Error("Production is forbidden for development and test operations.");
  if (purpose === "operations" && (row.branch_id !== PRODUCTION.branchId || row.database !== PRODUCTION.database)) throw new Error("Production maintenance requires the explicit production target.");
  return row;
}

module.exports = { PRODUCTION, endpointId, assertRuntimeTarget, assertDatabaseTarget };
