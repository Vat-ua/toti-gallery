import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, randomInt, createHash } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";
import { accountRouteHarness } from "./helpers/account-route-harness";
import type { ImageMetadata } from "../src/lib/image-policy";

let pool: typeof import("../src/db").pool;
let harness: ReturnType<typeof accountRouteHarness>;
let baseline: Record<string, string>;
let ownerCookie: string, otherCookie: string;
const owner = randomUUID(), other = randomUUID(), group = randomUUID();
const origin = "http://localhost:3101";
const password = "Account fixture initial password 2026!";
const newPassword = "Account fixture replacement password 2026!";
const email = (id: string) => `${id}@example.invalid`;
const cookie = (response: Response) => response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
const input = (patch: Record<string, unknown> = {}) => ({ name: "Perfil de teste", bio: "Descrição de teste", github: "https://github.com/example", linkedin: "https://www.linkedin.com/in/example", avatar: null, ...patch });
async function row(id = owner) { return (await pool.query("SELECT * FROM gallery_users WHERE id=$1", [id])).rows[0]; }
async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows) {
    result[tablename] = createHash("sha256").update(JSON.stringify((await pool.query(`SELECT * FROM "${tablename}"`)).rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return result;
}
function request(path: string, body: Record<string, unknown>, options: { file?: boolean; cookie?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { origin: options.origin ?? origin, cookie: options.cookie ?? ownerCookie };
  let data: string | FormData;
  if (options.file) { data = new FormData(); data.set("data", JSON.stringify(body)); data.set("image", new File(["fixture"], "avatar.png", { type: "image/png" })); }
  else { headers["content-type"] = "application/json"; data = JSON.stringify(body); }
  harness.state.headers = new Headers(headers);
  return new Request(origin + path, { method: path.endsWith("password") ? "POST" : "PATCH", headers, body: data });
}
async function login(id: string, value = password) {
  return harness.auth.api.signInEmail({ body: { email: email(id), password: value }, headers: new Headers({ origin }), asResponse: true });
}
async function attachImage(): Promise<ImageMetadata> {
  const metadata: ImageMetadata = { key: `avatars/${randomUUID()}.webp`, width: 512, height: 512, bytes: 100, format: "webp" };
  await pool.query("UPDATE gallery_users SET avatar=$1,avatar_metadata=$2 WHERE id=$3", [`/media/${metadata.key}`, metadata, owner]);
  return metadata;
}
before(async () => {
  const loaded = config({ path: process.env.GALLERY_ACCOUNT_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  if (loaded.error) throw new Error("Select an isolated current-schema test database.");
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  process.env.BETTER_AUTH_URL = origin; process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url");
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  ({ pool } = await import("../src/db")); await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot(); harness = accountRouteHarness();
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(password);
  const number = randomInt(1000000, 800000000);
  await pool.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year) VALUES($1,$2,$3,'Fixture',2026)", [group, `Turma ${number}`, number]);
  for (const id of [owner, other]) {
    await pool.query("INSERT INTO gallery_users(id,name,email,email_verified,status) VALUES($1,'Account fixture',$2,true,'active')", [id, email(id)]);
    await pool.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [id, group]);
    await pool.query("INSERT INTO gallery_auth_accounts(id,user_id,provider_id,account_id,password) VALUES($1,$2,'credential',$2,$3)", [randomUUID(), id, hash]);
  }
  const signed = await login(owner), second = await login(other);
  assert.equal(signed.status, 200); assert.equal(second.status, 200);
  ownerCookie = cookie(signed); otherCookie = cookie(second);
});
beforeEach(() => { harness.reset(); });
after(async () => {
  if (!pool) return;
  try {
    if (baseline) {
      await pool.query("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[])", [[owner, other]]);
      await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [[owner, other]]);
      await pool.query("DELETE FROM gallery_turmas WHERE id=$1", [group]);
      assert.deepEqual(await snapshot(), baseline, "Original test rows changed");
    }
  } finally { harness?.restore(); await pool.end(); }
});

test("profile and password require a real active session and matching origin", async () => {
  for (const path of ["/api/account", "/api/account/password"]) {
    const handler = path.endsWith("password") ? harness.password.POST : harness.profile.PATCH;
    assert.equal((await handler(request(path, {}, { cookie: "" }))).status, 401);
    assert.equal((await handler(request(path, {}, { origin: "https://foreign.invalid" }))).status, 403);
  }
  await pool.query("UPDATE gallery_users SET status='suspended' WHERE id=$1", [other]);
  try { assert.equal((await harness.profile.PATCH(request("/api/account", input(), { cookie: otherCookie }))).status, 401); }
  finally { await pool.query("UPDATE gallery_users SET status='active' WHERE id=$1", [other]); }
});
test("profile saves only editable fields, returns the complete public user and preserves identity", async () => {
  const original = await row(), untouched = await row(other);
  const response = await harness.profile.PATCH(request("/api/account", input()));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.equal(result.user.id, owner); assert.equal(result.user.slug, original.slug); assert.equal(result.user.name, "Perfil de teste");
  assert.equal(result.user.linkedin, input().linkedin); assert.equal(result.user.courseName, "Fixture"); assert.equal(result.user.role, "user");
  const stored = await row();
  for (const field of ["id", "slug", "email", "email_verified", "role", "status", "is_demo", "created_at", "primary_turma_id"]) assert.deepEqual(stored[field], original[field], field);
  assert.deepEqual(await row(other), untouched);
  for (const patch of [{ id: other }, { role: "owner" }, { email: "new@example.invalid" }, { status: "active" }]) assert.equal((await harness.profile.PATCH(request("/api/account", input(patch)))).status, 400);
  const invalid = await harness.profile.PATCH(request("/api/account", input({ name: "x", github: "http://github.com/example" })));
  assert.equal(invalid.status, 400); const body = await invalid.json(); assert.ok(body.fieldErrors.name); assert.ok(body.fieldErrors.github);
});
test("avatar keep/replace/remove uses transaction-safe metadata and deferred retirement", async () => {
  const old = await attachImage();
  const kept = await harness.profile.PATCH(request("/api/account", input({ avatar: `/media/${old.key}` })));
  assert.equal(kept.status, 200); assert.deepEqual((await row()).avatar_metadata, old); assert.equal(harness.state.deferred.length, 0);
  const replaced = await harness.profile.PATCH(request("/api/account", input(), { file: true }));
  assert.equal(replaced.status, 200); assert.deepEqual((await row()).avatar_metadata, harness.state.uploaded[0]);
  assert.deepEqual(harness.state.retired, []); await harness.flush(); assert.deepEqual(harness.state.retired, [old]);
  const next = (await row()).avatar_metadata;
  assert.equal((await harness.profile.PATCH(request("/api/account", input()))).status, 200);
  assert.equal((await row()).avatar, null); assert.equal((await row()).avatar_metadata, null);
  await harness.flush(); assert.deepEqual(harness.state.retired, [old, next]); assert.deepEqual(harness.state.deleted, []);
});
test("upload failures and throttling keep the original profile and image", async () => {
  await attachImage(); const original = await row();
  harness.state.allowUpload = false;
  assert.equal((await harness.profile.PATCH(request("/api/account", input(), { file: true }))).status, 429);
  assert.equal(harness.state.uploaded.length, 0); assert.deepEqual(await row(), original);
  harness.state.allowUpload = true; harness.state.uploadError = new Error("Fixture upload failed");
  assert.equal((await harness.profile.PATCH(request("/api/account", input(), { file: true }))).status, 400);
  assert.deepEqual(await row(), original); assert.equal(harness.state.deferred.length, 0);
});
test("SQL failure rolls back profile changes and removes only the newly uploaded avatar", async () => {
  const old = await attachImage(), original = await row();
  // A trigger scoped to this fixture injects a real SQL error after upload.
  const name = `account_failure_${owner.replaceAll("-", "")}`;
  await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${owner}' THEN RAISE EXCEPTION 'fixture profile update rejected'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${name} BEFORE UPDATE ON gallery_users FOR EACH ROW EXECUTE FUNCTION ${name}()`);
  try {
    const response = await harness.profile.PATCH(request("/api/account", input(), { file: true }));
    assert.equal(response.status, 400); assert.equal((await response.json()).error, "Não foi possível salvar seu perfil. Tente novamente.");
    assert.deepEqual(await row(), original); assert.deepEqual(harness.state.deleted, harness.state.uploaded);
    assert.equal(harness.state.deleted.length, 1); assert.notEqual(harness.state.deleted[0].key, old.key); assert.equal(harness.state.deferred.length, 0);
  } finally { await pool.query(`DROP TRIGGER ${name} ON gallery_users`); await pool.query(`DROP FUNCTION ${name}()`); }
});
test("password validates fields, rejects wrong current password and preserves cookies/session semantics", async () => {
  const current = () => ({ currentPassword: password, newPassword, confirmPassword: newPassword });
  const originalUser = await row();
  const bad = await harness.password.POST(request("/api/account/password", { ...current(), confirmPassword: "different" }));
  assert.equal(bad.status, 400); assert.ok((await bad.json()).fieldErrors.confirmPassword);
  const wrong = await harness.password.POST(request("/api/account/password", { ...current(), currentPassword: "wrong password" }));
  assert.equal(wrong.status, 400); assert.ok((await wrong.json()).fieldErrors.currentPassword);
  harness.state.allowPassword = false;
  const limited = await harness.password.POST(request("/api/account/password", current()));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get("retry-after"), "900"); harness.state.allowPassword = true;
  const second = await login(owner); assert.equal(second.status, 200); const secondCookie = cookie(second);
  const success = await harness.password.POST(request("/api/account/password", current()));
  assert.equal(success.status, 200); assert.equal(success.headers.get("cache-control"), "no-store");
  const updatedCookie = cookie(success); assert.match(updatedCookie, /toti_gallery\.session_token=/);
  assert.equal(await harness.auth.api.getSession({ headers: new Headers({ cookie: secondCookie }) }), null);
  assert.equal((await harness.auth.api.getSession({ headers: new Headers({ cookie: updatedCookie }) }))?.user.id, owner);
  ownerCookie = updatedCookie;
  assert.equal((await login(owner, password)).status, 401); assert.equal((await login(owner, newPassword)).status, 200);
  assert.deepEqual(await row(), originalUser, "Password changes must not edit the profile row");
});

test("a concurrent avatar replacement cannot be overwritten by a stale photo reference", async () => {
  const old = await attachImage();
  const replacement: ImageMetadata = { ...old, key: `avatars/${randomUUID()}.webp` };
  const writer = await pool.connect();
  let pending: Promise<Response> | undefined;
  try {
    await writer.query("BEGIN"); const pid = (await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    await writer.query("UPDATE gallery_users SET avatar=$1,avatar_metadata=$2 WHERE id=$3", [`/media/${replacement.key}`, replacement, owner]);
    pending = harness.profile.PATCH(request("/api/account", input({ avatar: `/media/${old.key}` })));
    const deadline = Date.now() + 15000; let blocked = false;
    while (Date.now() < deadline) {
      blocked = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND datname=current_database()", [pid])).rowCount! > 0;
      if (blocked) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(blocked, "Profile update must reach its transaction row lock");
    await writer.query("COMMIT"); const response = await pending;
    assert.equal(response.status, 400); assert.match((await response.json()).error, /foto mudou/);
    assert.equal((await row()).avatar, `/media/${replacement.key}`); assert.equal(harness.state.deferred.length, 0);
  } finally { await writer.query("ROLLBACK"); writer.release(); if (pending) await pending; }
});

test("committed profile returns its saved user without a second session lookup", async () => {
  harness.state.failSecondSessionCheck = true;
  const name = "Saved profile response";
  const response = await harness.profile.PATCH(request("/api/account", input({ name })));
  assert.equal((await row()).name, name, "The update already reached PostgreSQL");
  assert.equal(response.status, 200, "A post-commit session failure must not report a failed save");
  const result = await response.json(); assert.equal(result.user.id, owner); assert.equal(result.user.name, name);
  assert.equal(harness.state.sessionChecks, 1);
});
