const { spawn } = require("node:child_process");
const { Pool } = require("pg");
const { smokeEnvironment } = require("./lib/smoke-environment.cjs");
const { assertDatabaseTarget } = require("../src/lib/database-target.cjs");
(async () => {
  const env = smokeEnvironment();
  const mode = process.argv[2];
  if (!["build", "start"].includes(mode)) throw new Error("Use build or start.");
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  try { await assertDatabaseTarget(pool, env, "test"); } finally { await pool.end(); }
  const args = ["node_modules/next/dist/bin/next", mode, ...(mode === "build" ? ["--webpack"] : ["--hostname", "127.0.0.1", "--port", "3102"])];
  const child = spawn(process.execPath, args, { stdio: "inherit", env });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Smoke server could not start."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
})().catch(() => { console.error("Smoke database/configuration rejected. No server started; see docs/testing.md."); process.exitCode = 1; });
