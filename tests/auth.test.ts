import { before, beforeEach, after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";
import { config } from "dotenv";
import { assertRuntimeTarget, assertDatabaseTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let auth: ReturnType<typeof import("../src/lib/auth-core").getAuth>;
let access: typeof import("../src/lib/access-links");
let provisioning: typeof import("../src/lib/admin-provision");
let adminId: string, turmaId: string, demoId: string, demoEmail: string;
let ready = false;
const userIds = new Set<string>();
const password = "A safe fixture password 2026!";
const nextPassword = "A different fixture password 2026!";
const origin = "http://localhost:3101";
const realFetch = globalThis.fetch;
let googleProfile = { sub: "fixture-google-subject", email: "", email_verified: true, name: "Provider name" };
let requestSequence = 0;

const token = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;
const cookie = (response: Response) => response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
const post = (path: string, body: unknown, jar = "", ip?: string) => auth.handler(new Request(origin + "/api/auth" + path, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: jar, "x-real-ip": ip || `192.0.2.${++requestSequence % 200 + 1}` }, body: JSON.stringify(body),
}));
const login = (email: string, value = password) => post("/sign-in/email", { email, password: value });
async function sql(query: string, values: unknown[] = []) { return (await pool.query(query, values)).rows; }
async function ensureAdmin() {
  if (adminId) return;
  const email = `auth-owner-${randomUUID()}@example.invalid`;
  const grant = await provisioning.bootstrapAdmin("Fixture Administrator", email);
  adminId = (await sql("SELECT id FROM gallery_users WHERE email=$1", [email]))[0].id;
  userIds.add(adminId);
  await access.consumeAccessLink(token(grant.url), password, password);
}
async function student(name: string) {
  await ensureAdmin();
  const email = `auth-${name}-${randomUUID()}@example.invalid`;
  const user = await provisioning.provisionStudent(adminId, `Fixture ${name}`, email, turmaId);
  userIds.add(user.id);
  return { ...user, email };
}

async function assertEmpty() {
  const tables = await sql("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%'");
  assert.ok(tables.length > 0, "Prepare the current test schema first");
  for (const { tablename } of tables) {
    assert.equal((await sql(`SELECT count(*)::int AS n FROM "${tablename}"`))[0].n, 0, `${tablename} must be empty; auth fixtures require exclusive ownership`);
  }
}

async function googleLogin(profile: typeof googleProfile, withCookie = true, callbackURL = "/meus-projetos", activationToken?: string) {
  googleProfile = profile;
  const started = await post("/sign-in/social", { provider: "google", callbackURL, errorCallbackURL: "/entrar", disableRedirect: true, ...(activationToken ? { additionalData: { activationToken } } : {}) });
  assert.equal(started.status, 200, "Google redirect initiation failed");
  if (activationToken) assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_auth_verifications WHERE value LIKE $1", ["%" + activationToken + "%"]))[0].n, 0, "Bearer token leaked into OAuth state");
  const location = new URL((await started.json()).url);
  assert.equal(location.origin, "https://accounts.google.com");
  assert.equal(location.searchParams.get("redirect_uri"), origin + "/api/auth/callback/google");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  const response = await auth.handler(new Request(origin + "/api/auth/callback/google?code=fixture-code&state=" + location.searchParams.get("state"), {
    headers: { Cookie: withCookie ? cookie(started) : "", "x-real-ip": "192.0.2.240" },
  }));
  return response;
}

before(async () => {
  const loaded = config({ path: process.env.GALLERY_AUTH_TEST_ENV_FILE || ".env.auth-workflows", override: true, quiet: true });
  assert.ok(!loaded.error, "Select an empty current-schema disposable test database");
  assert.equal(process.env.GALLERY_DATABASE_ENV, "test");
  assert.equal(process.env.GALLERY_LOCAL_TEST_DATABASE, "1", "Auth workflow fixtures require a disposable loopback database");
  assert.equal(process.env.BETTER_AUTH_URL, origin);
  delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  delete process.env.VERCEL_ENV;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  process.env.GOOGLE_CLIENT_ID = "fixture-google-client";
  process.env.GOOGLE_CLIENT_SECRET = "fixture-google-secret";
  // Simulate only Google's server-to-server response. This is NOT real Google
  // verification and does not satisfy the public Vercel OAuth acceptance gate.
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://oauth2.googleapis.com/token") {
      const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "fixture" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ ...googleProfile, iss: "https://accounts.google.com", aud: "fixture-google-client", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
      return Response.json({ access_token: "fixture-access-token", token_type: "Bearer", expires_in: 3600, id_token: `${header}.${payload}.fixture` });
    }
    if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [] });
    if (url.startsWith("https://")) throw new Error("Unexpected external request in isolated authentication test");
    return realFetch(input, init);
  };
  ({ pool } = await import("../src/db"));
  await assertDatabaseTarget(pool, process.env, "test");
  await assertEmpty();
  ready = true;
  access = await import("../src/lib/access-links");
  provisioning = await import("../src/lib/admin-provision");
  auth = (await import("../src/lib/auth-core")).getAuth();
});

beforeEach(async () => {
  await assertEmpty();
  adminId = ""; turmaId = randomUUID(); demoId = randomUUID();
  demoEmail = `auth-demo-${demoId}@example.invalid`;
  userIds.add(demoId);
  const number = randomInt(1000000, 800000000);
  await sql("INSERT INTO gallery_turmas(id,name,number) VALUES($1,$2,$3)", [turmaId, `Turma ${number}`, number]);
  await sql("INSERT INTO gallery_users(id,name,email,status,is_demo) VALUES($1,'Demo fixture',$2,'active',true)", [demoId, demoEmail]);
});

// No shared mutable accounts, OAuth state or limiter budget between cases.
// The initial empty-table guard gives this suite exclusive ownership of the
// ephemeral auth rows, including unsuccessful OAuth state and IP rate limits.
afterEach(async () => {
  if (!ready) return;
  const ids = [...userIds];
  await sql("DELETE FROM gallery_invitations WHERE user_id=ANY($1::text[]) OR created_by=ANY($1::text[])", [ids]);
  await sql("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[])", [ids]);
  await sql("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [ids]);
  await sql("DELETE FROM gallery_turmas WHERE id=$1", [turmaId]);
  await sql("DELETE FROM gallery_auth_verifications");
  await sql("DELETE FROM gallery_auth_rate_limits");
  userIds.clear();
  await assertEmpty();
});

test("first administrator bootstrap is closed and uses one-time activation", async () => {
  const email = `auth-bootstrap-${randomUUID()}@example.invalid`;
  const grant = await provisioning.bootstrapAdmin("Fixture Administrator", email);
  adminId = (await sql("SELECT id FROM gallery_users WHERE email=$1", [email]))[0].id;
  userIds.add(adminId);
  assert.equal((await login(email)).status, 401);
  const reissued = await provisioning.bootstrapAdmin("Fixture Administrator", email);
  await assert.rejects(() => access.consumeAccessLink(token(grant.url), password, password));
  await access.consumeAccessLink(token(reissued.url), password, password);
  const signed = await login(email);
  assert.equal(signed.status, 200);
  assert.match(cookie(signed), /toti_gallery\.session_token=/);
  const [user] = await sql("SELECT status,email_verified,role FROM gallery_users WHERE id=$1", [adminId]);
  assert.equal(user.status, "active"); assert.equal(user.email_verified, true); assert.equal(user.role, "owner");
  await assert.rejects(() => provisioning.bootstrapAdmin("Other Administrator", "other-admin@example.invalid"));
  await assert.rejects(() => access.consumeAccessLink(token(reissued.url), nextPassword, nextPassword));
});

test("demo and public registration cannot create access; identity fields stay server-owned", async () => {
  await ensureAdmin();
  assert.equal((await login(demoEmail, password)).status, 401);
  const open = await post("/sign-up/email", { name: "Intruder", email: "intruder@example.invalid", password, role: "admin", status: "active" });
  assert.ok(open.status >= 400);
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_users WHERE email='intruder@example.invalid'"))[0].n, 0);
  const [demo] = await sql("SELECT id FROM gallery_users WHERE is_demo ORDER BY id LIMIT 1");
  await assert.rejects(() => access.createAccessLink(adminId, demo.id, "password_reset"));
  await assert.rejects(() => provisioning.provisionStudent(adminId, "Demo takeover", demoEmail, turmaId));
});

test("activation validates passwords, expiry and revocation; simultaneous redemption succeeds once", async () => {
  const user = await student("activation");
  let grant = await access.createAccessLink(adminId, user.id, "activation");
  await assert.rejects(() => access.consumeAccessLink(token(grant.url), "short", "short"));
  await assert.rejects(() => access.consumeAccessLink(token(grant.url), password, nextPassword));
  await sql("UPDATE gallery_invitations SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1", [grant.id]);
  await assert.rejects(() => access.consumeAccessLink(token(grant.url), password, password));
  grant = await access.createAccessLink(adminId, user.id, "activation");
  const newer = await access.createAccessLink(adminId, user.id, "activation");
  await assert.rejects(() => access.consumeAccessLink(token(grant.url), password, password));
  const outcomes = await Promise.allSettled([access.consumeAccessLink(token(newer.url), password, password), access.consumeAccessLink(token(newer.url), nextPassword, nextPassword)]);
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_auth_accounts WHERE user_id=$1", [user.id]))[0].n, 1);
});

test("password reset preserves the account and invalidates all sessions", async () => {
  const user = await student("recovery");
  const grant = await access.createAccessLink(adminId, user.id, "activation");
  await access.consumeAccessLink(token(grant.url), password, password);
  const first = await login(user.email); const second = await login(user.email);
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  const reset = await access.createAccessLink(adminId, user.id, "password_reset");
  await access.consumeAccessLink(token(reset.url), nextPassword, nextPassword);
  assert.equal((await login(user.email)).status, 401);
  assert.equal((await login(user.email, nextPassword)).status, 200);
  const oldSession = await auth.handler(new Request(origin + "/api/auth/get-session", { headers: { Cookie: cookie(first) } }));
  assert.equal(await oldSession.json(), null);
  assert.equal((await sql("SELECT id FROM gallery_users WHERE email=$1", [user.email]))[0].id, user.id);
});

test("a verified Google callback activates the imported ID without credentials; optional password uses the same ID", async () => {
  const user = await student("google");
  const activation = await access.createAccessLink(adminId, user.id, "activation");
  const response = await googleLogin({ sub: "fixture-student-google-subject", email: user.email, email_verified: true, name: "Google provided name" });
  assert.equal(response.status, 302);
  assert.ok(response.headers.get("location")?.endsWith("/meus-projetos"), "Mock Google callback did not issue the expected application redirect");
  assert.match(cookie(response), /toti_gallery\.session_token=/);
  const [row] = await sql("SELECT id,status,email_verified,name FROM gallery_users WHERE email=$1", [user.email]);
  assert.equal(row.id, user.id); assert.equal(row.status, "active"); assert.equal(row.email_verified, true); assert.equal(row.name, "Fixture google");
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_auth_accounts WHERE user_id=$1 AND provider_id='credential'", [user.id]))[0].n, 0);
  await assert.rejects(() => access.consumeAccessLink(token(activation.url), password, password));
  const reset = await access.createAccessLink(adminId, user.id, "password_reset");
  await access.consumeAccessLink(token(reset.url), password, password);
  assert.equal((await login(user.email)).status, 200);
  const [identities] = await sql("SELECT count(*)::int AS n,count(DISTINCT user_id)::int AS users FROM gallery_auth_accounts WHERE user_id=$1", [user.id]);
  assert.equal(identities.n, 2); assert.equal(identities.users, 1);
});

test("Google rejects unapproved, unverified, demo, suspended and state-less callbacks", async () => {
  await ensureAdmin();
  const before = (await sql("SELECT count(*)::int AS n FROM gallery_users"))[0].n;
  let result = await googleLogin({ sub: "unknown-subject", email: "unknown@example.invalid", email_verified: true, name: "Unknown" });
  assert.ok(result.headers.get("location")?.includes("error="));
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_users"))[0].n, before);
  const user = await student("google-denied");
  result = await googleLogin({ sub: "unverified-subject", email: user.email, email_verified: false, name: "Unverified" });
  assert.ok(result.headers.get("location")?.includes("error="));
  assert.equal((await sql("SELECT status FROM gallery_users WHERE id=$1", [user.id]))[0].status, "pending");
  result = await googleLogin({ sub: "demo-subject", email: demoEmail, email_verified: true, name: "Demo" });
  assert.ok(result.headers.get("location")?.includes("error="));
  await sql("UPDATE gallery_users SET status='suspended' WHERE id=$1", [user.id]);
  result = await googleLogin({ sub: "suspended-subject", email: user.email, email_verified: true, name: "Suspended" });
  assert.ok(result.headers.get("location")?.includes("error="));
  const stateUser = await student("google-state");
  result = await googleLogin({ sub: "state-subject", email: stateUser.email, email_verified: true, name: "State" }, false);
  assert.ok(result.headers.get("location")?.includes("error="));
  assert.equal((await sql("SELECT status FROM gallery_users WHERE id=$1", [stateUser.id]))[0].status, "pending");
});

test("existing local identity can also use Google, while mismatched identity changes are rejected", async () => {
  const user = await student("both");
  const grant = await access.createAccessLink(adminId, user.id, "activation");
  await access.consumeAccessLink(token(grant.url), password, password);
  let result = await googleLogin({ sub: "both-google-subject", email: user.email, email_verified: true, name: "Provider name" });
  assert.ok(result.headers.get("location")?.endsWith("/meus-projetos"));
  result = await googleLogin({ sub: "both-google-subject", email: "different@example.invalid", email_verified: true, name: "Changed identity" });
  assert.ok(result.headers.get("location")?.includes("error="));
  assert.equal((await login(user.email)).status, 200);
});

test("origin protection, callback restrictions and durable login throttling", async () => {
  const badOrigin = await auth.handler(new Request(origin + "/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.invalid", "x-real-ip": "192.0.2.250" }, body: JSON.stringify({ email: "fixture-first-admin@example.invalid", password }) }));
  assert.equal(badOrigin.status, 403);
  const badRedirect = await post("/sign-in/social", { provider: "google", callbackURL: "https://attacker.invalid", disableRedirect: true });
  assert.equal(badRedirect.status, 403);
  let status = 0;
  for (let i = 0; i < 11; i++) status = (await post("/sign-in/email", { email: "no-account@example.invalid", password }, "", "192.0.2.251")).status;
  assert.equal(status, 429);
  assert.ok((await sql("SELECT count(*)::int AS n FROM gallery_auth_rate_limits"))[0].n > 0);
});

test("suspended accounts cannot open new sessions or issue grants", async () => {
  const user = await student("suspended");
  const grant = await access.createAccessLink(adminId, user.id, "activation");
  await access.consumeAccessLink(token(grant.url), password, password);
  await sql("UPDATE gallery_users SET status='suspended' WHERE id=$1", [user.id]);
  assert.equal((await login(user.email)).status, 403);
  await assert.rejects(() => access.createAccessLink(adminId, user.id, "password_reset"));
  await assert.rejects(() => access.createAccessLink(user.id, adminId, "password_reset"));
});

test("activation preview is read-only and Google must match the invited identity", async () => {
  const invited = await student("invited-google");
  const other = await student("other-google");
  const grant = await access.createAccessLink(adminId, invited.id, "activation");
  const raw = token(grant.url);
  const metadata = await access.inspectAccessLink(raw);
  assert.equal(metadata.email, invited.email); assert.equal(metadata.purpose, "activation");
  assert.equal((await sql("SELECT status FROM gallery_users WHERE id=$1", [invited.id]))[0].status, "pending");
  const wrong = await googleLogin({ sub: "wrong-invite-subject", email: other.email, email_verified: true, name: "Other" }, true, "/meus-projetos", raw);
  assert.equal(wrong.status, 302); assert.ok(wrong.headers.get("location")?.includes("activation_account_mismatch"));
  assert.equal((await sql("SELECT status FROM gallery_users WHERE id=$1", [other.id]))[0].status, "pending");
  const correct = await googleLogin({ sub: "correct-invite-subject", email: invited.email, email_verified: true, name: "Invited" }, true, "/meus-projetos", raw);
  assert.equal(correct.status, 302); assert.ok(cookie(correct).includes("session_token="));
  assert.equal((await sql("SELECT status FROM gallery_users WHERE id=$1", [invited.id]))[0].status, "active");
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_auth_accounts WHERE user_id=$1 AND provider_id='credential'", [invited.id]))[0].n, 0);
  await assert.rejects(() => access.inspectAccessLink(raw));
  const reset = await access.createAccessLink(adminId, invited.id, "password_reset");
  assert.equal((await access.inspectAccessLink(token(reset.url))).purpose, "password_reset");
});

after(async () => {
  globalThis.fetch = realFetch;
  if (pool) await pool.end();
});
