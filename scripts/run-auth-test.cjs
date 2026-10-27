const { config } = require("dotenv");
const { spawn } = require("node:child_process");
const { Pool } = require("pg");
const { assertRuntimeTarget, assertDatabaseTarget } = require("../src/lib/database-target.cjs");
const result = config({ path: ".env.auth-test", override: true, quiet: true });
if (result.error || process.env.GALLERY_DATABASE_ENV !== "test" || !/^gallery_auth_test_\d+_[a-f0-9]{8}$/.test(process.env.AUTH_TEST_DATABASE_NAME || "") || new URL(process.env.DATABASE_URL).pathname !== "/" + process.env.AUTH_TEST_DATABASE_NAME) {
  console.error("Prepare an isolated test branch first; see docs/environments.md. For development use npm run dev."); process.exit(1);
}
delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
delete process.env.VERCEL_ENV;
assertRuntimeTarget(process.env.DATABASE_URL);
const mode = process.argv[2] || "dev";
if (!["dev", "build", "start"].includes(mode)) process.exit(1);
const args = ["node_modules/next/dist/bin/next", mode, ...process.argv.slice(3)];
if (mode !== "build") args.push("--port", "3101");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try { await assertDatabaseTarget(pool, process.env, "test"); } finally { await pool.end(); }
  const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  child.on("exit", code => { process.exitCode = code || 0; });
})().catch(() => { console.error("Test database target rejected. No server started."); process.exitCode = 1; });
