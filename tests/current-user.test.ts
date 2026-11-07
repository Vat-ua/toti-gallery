import { before, after, beforeEach, test, mock } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { config } from "dotenv";
import { serializeSignedCookie } from "better-call";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";

const require = createRequire(`${process.cwd()}/package.json`);
const headersPath = require.resolve("next/headers"), originalHeaders = require.cache[headersPath];
let requestHeaders = new Headers(), pool: typeof import("../src/db").pool;
let auth: typeof import("../src/lib/auth");
let jar = "", verified = false;
const id = randomUUID(), group = randomUUID(), token = randomBytes(32).toString("hex");
const queries: string[] = [];
before(async () => {
  const loaded = config({ path: process.env.GALLERY_IDENTITY_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  if (loaded.error && !(process.env.CI && process.env.GALLERY_LOCAL_TEST_DATABASE === "1")) throw loaded.error;
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("base64url"); process.env.BETTER_AUTH_URL = "http://localhost:3101";
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  ({ pool } = await import("../src/db")); await assertDatabaseTarget(pool, process.env, "test"); verified = true;
  require.cache[headersPath] = { id: headersPath, filename: headersPath, loaded: true, exports: { headers: async () => requestHeaders, cookies: async () => ({ get: () => undefined }) } } as NodeJS.Module;
  auth = await import("../src/lib/auth");
  const original = pool.query;
  mock.method(pool, "query", (...args: unknown[]) => {
    const first = args[0]; queries.push(typeof first === "string" ? first : String((first as { text: string }).text));
    return Reflect.apply(original, pool, args);
  });
  await pool.query("INSERT INTO gallery_users(id,name,email,email_verified,status) VALUES($1,'Identity fixture',$2,true,'active')", [id, `${id}@example.invalid`]);
  const number = randomInt(1000000, 800000000);
  await pool.query("INSERT INTO gallery_turmas(id,name,number,archived_at) VALUES($1,$2,$3,now())", [group, `Turma ${number}`, number]);
  await pool.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [id, group]);
  jar = (await serializeSignedCookie("toti_gallery.session_token", token, process.env.BETTER_AUTH_SECRET)).split(";")[0];
});
beforeEach(async () => {
  await pool.query("UPDATE gallery_users SET status='active',email_verified=true,is_demo=false,role='user' WHERE id=$1", [id]);
  await pool.query("DELETE FROM gallery_auth_sessions WHERE user_id=$1", [id]);
  await pool.query("INSERT INTO gallery_auth_sessions(id,user_id,token,expires_at) VALUES($1,$2,$3,now()+interval '1 day')", [randomUUID(), id, token]);
  requestHeaders = new Headers({ cookie: jar }); queries.length = 0;
});
after(async () => {
  try {
    mock.restoreAll();
    if (verified && pool) { await pool.query("DELETE FROM gallery_turma_members WHERE user_id=$1", [id]); await pool.query("DELETE FROM gallery_users WHERE id=$1", [id]); await pool.query("DELETE FROM gallery_turmas WHERE id=$1", [group]); }
  } finally { await pool?.end(); if (originalHeaders) require.cache[headersPath] = originalHeaders; else delete require.cache[headersPath]; }
});

test("anonymous and invalidly signed cookies do not read PostgreSQL", async () => {
  for (const cookie of ["", "toti_gallery.session_token=invalid.signature"]) {
    requestHeaders = new Headers({ cookie }); queries.length = 0;
    assert.equal(await auth.getCurrentUser(), null); assert.equal(queries.length, 0);
  }
});
test("identity uses two live queries, including a native Better Auth session/user join", async () => {
  const user = await auth.getCurrentUser();
  assert.equal(user?.id, id); assert.equal(user?.role, "user"); assert.equal(user?.turmaId, group);
  assert.equal(queries.length, 2); assert(queries[0].includes("gallery_auth_sessions") && queries[0].includes("gallery_users"));
  assert(!("email" in user!)); assert(!("token" in user!));
});
test("role changes are visible on the next request without a persistent permission cache", async () => {
  assert.equal((await auth.getCurrentUser())?.role, "user");
  await pool.query("UPDATE gallery_users SET role='admin' WHERE id=$1", [id]);
  assert.equal((await auth.getCurrentUser())?.role, "admin");
});
test("public ownership checks reject unrelated identities and recheck an owner's live access", async () => {
  assert.equal(await auth.isCurrentUser(randomUUID()), false); assert.equal(queries.length, 1);
  assert.equal(await auth.isCurrentUser(id), true);
  await pool.query("UPDATE gallery_users SET status='suspended' WHERE id=$1", [id]);
  assert.equal(await auth.isCurrentUser(id), false);
});
test("suspended, pending, unverified and demo accounts cannot authorize an existing session", async () => {
  for (const patch of ["status='suspended'", "status='pending'", "email_verified=false", "is_demo=true"]) {
    await pool.query("UPDATE gallery_users SET status='active',email_verified=true,is_demo=false WHERE id=$1", [id]);
    await pool.query(`UPDATE gallery_users SET ${patch} WHERE id=$1`, [id]);
    assert.equal(await auth.getCurrentUser(), null);
  }
});
test("expired and revoked sessions cannot authorize", async () => {
  await pool.query("UPDATE gallery_auth_sessions SET expires_at=now()-interval '1 day' WHERE user_id=$1", [id]);
  assert.equal(await auth.getCurrentUser(), null);
  await pool.query("DELETE FROM gallery_auth_sessions WHERE user_id=$1", [id]);
  assert.equal(await auth.getCurrentUser(), null);
});
test("an active account without turma membership still has valid access", async () => {
  await pool.query("DELETE FROM gallery_turma_members WHERE user_id=$1", [id]);
  assert.equal((await auth.getCurrentUser())?.turmaId, null);
});
