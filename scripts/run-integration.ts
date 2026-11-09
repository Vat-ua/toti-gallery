import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { createCurrentTestSchema } from "../tests/helpers/current-test-schema";
import { isolatedTestEnvironment } from "./lib/smoke-environment.cjs";

// Only database suites: their client/HTTP unit companions already run in test:unit.
const suites = [
  "project-mutations", "account-mutations", "project-likes", "admin-concurrency",
  "admin-turmas", "admin-students", "admin-projects", "admin-administrators", "public-profiles",
];
const selectors = ["GALLERY_PROJECT_TEST_ENV_FILE", "GALLERY_ACCOUNT_TEST_ENV_FILE",
  "GALLERY_LIKES_TEST_ENV_FILE", "GALLERY_ADMIN_TEST_ENV_FILE", "GALLERY_PROFILE_TEST_ENV_FILE"];

async function main() {
  const env = isolatedTestEnvironment(process.env.GALLERY_INTEGRATION_ENV_FILE || ".env.integration");
  // This wrapper creates fixtures from scratch. Existing Neon suites remain separate.
  if (env.GALLERY_LOCAL_TEST_DATABASE !== "1") throw new Error("Integration runner requires a disposable loopback database.");
  env.BETTER_AUTH_URL = "http://localhost:3101";
  Object.assign(process.env, env);
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await createCurrentTestSchema(client);
      const owner = randomUUID();
      await client.query("INSERT INTO gallery_users(id,name,email,role,status,email_verified) VALUES($1,'Integration fixture owner',$2,'owner','active',true)", [owner, `${owner}@example.invalid`]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
    finally { client.release(); }
  } finally { await pool.end(); }

  // Existing suites consume explicit env files; no changes to their assertions or
  // target guards are needed. Do not reuse .env.admin-test or serialize cloud env.
  const directory = mkdtempSync(join(tmpdir(), "gallery-integration-"));
  try {
    const file = join(directory, "fixture.env");
    const keys = ["GALLERY_DATABASE_ENV", "GALLERY_LOCAL_TEST_DATABASE", "DATABASE_NAME",
      "DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"];
    writeFileSync(file, keys.map(key => `${key}=${JSON.stringify(env[key])}`).join("\n"), { mode: 0o600 });
    for (const key of selectors) env[key] = file;
    const child = spawn(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1",
      ...suites.map(suite => `tests/${suite}.test.ts`)], { stdio: "inherit", env });
    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    const interrupt = () => forward("SIGINT"), terminate = () => forward("SIGTERM");
    process.on("SIGINT", interrupt); process.on("SIGTERM", terminate);
    try {
      process.exitCode = await new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", code => resolve(code ?? 1));
      });
    } finally { process.off("SIGINT", interrupt); process.off("SIGTERM", terminate); }
  } finally { rmSync(directory, { recursive: true }); }
  // The CI service (or the explicit local owner) discards the DB. Never reset it.
}

main().catch(() => {
  console.error("Integration setup/run failed. Use an empty disposable loopback gallery_test_* database; see docs/testing.md. No database reset was attempted.");
  process.exitCode = 1;
});
