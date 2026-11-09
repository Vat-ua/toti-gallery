import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCTION } from "../src/lib/database-target.cjs";
const { smokeEnvironment, isolatedTestEnvironment, origin } = require("../scripts/lib/smoke-environment.cjs");
const original = { ...process.env }, directory = mkdtempSync(join(tmpdir(), "gallery-smoke-env-"));
const file = join(directory, "selected.env");
const selected = { GALLERY_DATABASE_ENV: "test", GALLERY_LOCAL_TEST_DATABASE: "1", DATABASE_NAME: "gallery_test_ci", DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:5432/gallery_test_ci" };
function select(values: Record<string, string>) {
  writeFileSync(file, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n"), { mode: 0o600 });
  process.env.GALLERY_SMOKE_ENV_FILE = file;
}
beforeEach(() => { process.env = { ...original }; delete process.env.CI; });
after(() => { process.env = original; rmSync(directory, { recursive: true }); });

test("smoke never falls back to development env when its explicit file is missing", () => {
  process.env.GALLERY_SMOKE_ENV_FILE = join(directory, "missing.env");
  process.env.DATABASE_URL = selected.DATABASE_URL;
  assert.throws(() => smokeEnvironment(), /explicit/);
});
test("smoke strips cloud integration credentials and uses a synthetic local auth secret", () => {
  process.env.GOOGLE_CLIENT_ID = "inherited-google"; process.env.AWS_SECRET_ACCESS_KEY = "inherited-storage";
  select({ ...selected, BETTER_AUTH_SECRET: "do-not-reuse-this-cloud-secret", GOOGLE_CLIENT_SECRET: "file-google", AWS_ACCESS_KEY_ID: "file-storage" });
  const env = smokeEnvironment();
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL_S3", "NEON_BRANCH_ID"]) assert.equal(env[key], "");
  assert.equal(env.BETTER_AUTH_URL, origin); assert.equal(origin, "http://127.0.0.1:3102");
  assert.ok(env.BETTER_AUTH_SECRET.length >= 32); assert.notEqual(env.BETTER_AUTH_SECRET, "do-not-reuse-this-cloud-secret");
});
test("smoke rejects development, production aliases and ordinary application database names", () => {
  const patches: Record<string, string>[] = [
    { GALLERY_DATABASE_ENV: "development" }, { DATABASE_NAME: "toti_gallery" },
    { DATABASE_URL: `postgresql://fixture:fixture@${PRODUCTION.endpointId}.example/gallery_test_ci`, GALLERY_LOCAL_TEST_DATABASE: "" },
    { VERCEL_ENV: "production" }, { GALLERY_ALLOW_PRODUCTION_DATABASE: "1" },
  ];
  for (const patch of patches) { select({ ...selected, ...patch }); assert.throws(() => smokeEnvironment()); }
});

test("integration selects only its explicit file, independently of smoke or admin configuration", () => {
  select(selected);
  process.env.GALLERY_SMOKE_ENV_FILE = join(directory, "wrong-smoke.env");
  process.env.GALLERY_ADMIN_TEST_ENV_FILE = ".env.local";
  const env = isolatedTestEnvironment(file);
  assert.equal(env.DATABASE_URL, selected.DATABASE_URL);
  assert.notEqual(env.BETTER_AUTH_SECRET, original.BETTER_AUTH_SECRET);
  assert.throws(() => isolatedTestEnvironment(join(directory, "missing-integration.env")), /explicit/);
});
