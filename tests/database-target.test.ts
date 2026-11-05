import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCTION, assertRuntimeTarget, assertDatabaseTarget } from "../src/lib/database-target.cjs";

const env = { GALLERY_DATABASE_ENV: "test", NEON_PROJECT_ID: PRODUCTION.projectId, NEON_BRANCH_ID: "br-test", NEON_ENDPOINT_ID: "ep-test", DATABASE_NAME: "toti_gallery" };
const client = (branch = "br-test", endpoint = "ep-test", database = "toti_gallery") => ({ query: async () => ({ rows: [{ project_id: PRODUCTION.projectId, branch_id: branch, endpoint_id: endpoint, database }] }) });
test("local runtime rejects production even when its database name matches development", () => {
  assert.throws(() => assertRuntimeTarget(`postgresql://fixture:fixture@${PRODUCTION.endpointId}-pooler.example/toti_gallery`, env), /production/i);
  assert.doesNotThrow(() => assertRuntimeTarget("postgresql://fixture:fixture@ep-test-pooler.example/toti_gallery", env));
});
test("live target validation rejects production aliases and mismatched identities before writes", async () => {
  await assertDatabaseTarget(client(), env, "test");
  await assert.rejects(() => assertDatabaseTarget(client(PRODUCTION.branchId), { ...env, NEON_BRANCH_ID: PRODUCTION.branchId }, "test"), /Production/);
  await assert.rejects(() => assertDatabaseTarget(client("br-other"), env, "test"), /does not match/);
  await assert.rejects(() => assertDatabaseTarget(client("br-test", "ep-other"), env, "test"), /does not match/);
  await assert.rejects(() => assertDatabaseTarget(client("br-test", "ep-test", "other"), env, "test"), /does not match/);
});
test("production needs its exact target and an explicit maintenance or Vercel context", () => {
  const url = `postgresql://fixture:fixture@${PRODUCTION.endpointId}.example/toti_gallery`;
  assert.throws(() => assertRuntimeTarget(url, {}), /production/i);
  assert.doesNotThrow(() => assertRuntimeTarget(url, { VERCEL_ENV: "production" }));
  assert.throws(() => assertRuntimeTarget(url.replace("toti_gallery", "legacy"), { VERCEL_ENV: "production" }), /does not match/);
});

const local = { GALLERY_DATABASE_ENV: "test", GALLERY_LOCAL_TEST_DATABASE: "1", DATABASE_NAME: "gallery_test_ci", DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:5432/gallery_test_ci" };
test("explicit local test target accepts only loopback and a dedicated test database", () => {
  assert.doesNotThrow(() => assertRuntimeTarget(local.DATABASE_URL, local));
  for (const change of [
    { DATABASE_URL: local.DATABASE_URL.replace("127.0.0.1", "example.com") },
    { DATABASE_URL: local.DATABASE_URL + "?host=example.com" },
    { DATABASE_URL: local.DATABASE_URL.replace("gallery_test_ci", "toti_gallery"), DATABASE_NAME: "toti_gallery" },
    { GALLERY_DATABASE_ENV: "development" }, { VERCEL_ENV: "production" }, { GALLERY_ALLOW_PRODUCTION_DATABASE: "1" },
  ]) { const selected = { ...local, ...change }; assert.throws(() => assertRuntimeTarget(selected.DATABASE_URL, selected)); }
  assert.throws(() => assertRuntimeTarget(local.DATABASE_URL, { ...local, GALLERY_LOCAL_TEST_DATABASE: undefined }));
});
test("local write verification rejects mismatched databases and any Neon identity", async () => {
  const plain = { query: async () => ({ rows: [{ database: local.DATABASE_NAME, project_id: "", branch_id: "", endpoint_id: "" }] }) };
  await assertDatabaseTarget(plain, local, "test");
  await assert.rejects(() => assertDatabaseTarget(plain, local, "development"));
  await assert.rejects(() => assertDatabaseTarget(client(), local, "test"));
  const wrong = { query: async () => ({ rows: [{ database: "other", project_id: "", branch_id: "", endpoint_id: "" }] }) };
  await assert.rejects(() => assertDatabaseTarget(wrong, local, "test"));
});
