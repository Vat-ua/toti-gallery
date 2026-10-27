import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { execFileSync } from "node:child_process";
import { assertRuntimeTarget, assertDatabaseTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let auth: ReturnType<typeof import("../src/lib/auth-core").getAuth>;
let access: typeof import("../src/lib/access-links");
let provisioning: typeof import("../src/lib/admin-provision");
let adminId: string;
const userIds = new Set<string>();
const password = "A safe fixture password 2026!";
const nextPassword = "A different fixture password 2026!";
const origin = "http://localhost:3101";
const checks: string[] = [];
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
async function student(name: string) {
  const [turma] = await sql("SELECT id FROM gallery_turmas WHERE name='Turma 24'");
  const email = `auth-${name}-${randomUUID()}@example.invalid`;
  const user = await provisioning.provisionStudent(adminId, `Fixture ${name}`, email, turma.id);
  userIds.add(user.id);
  return { ...user, email };
}

async function googleLogin(profile: typeof googleProfile, withCookie = true, callbackURL = "/meus-projetos") {
  googleProfile = profile;
  const started = await post("/sign-in/social", { provider: "google", callbackURL, errorCallbackURL: "/entrar", disableRedirect: true });
  assert.equal(started.status, 200, "Google redirect initiation failed");
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
  const loaded = config({ path: ".env.auth-test", override: true, quiet: true });
  assert.ok(!loaded.error, "Prepare the isolated database first");
  assert.match(process.env.AUTH_TEST_DATABASE_NAME || "", /^gallery_auth_test_\d+_[a-f0-9]{8}$/);
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, "/" + process.env.AUTH_TEST_DATABASE_NAME);
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
  assert.equal((await sql("SELECT current_database() AS name"))[0].name, process.env.AUTH_TEST_DATABASE_NAME);
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_users WHERE role='admin'"))[0].n, 0, "Tests require a fresh isolated DB with no real administrator");
  access = await import("../src/lib/access-links");
  provisioning = await import("../src/lib/admin-provision");
  auth = (await import("../src/lib/auth-core")).getAuth();
});

test("the migrated database matches the canonical schema and keeps demo content", async () => {
  const client = await pool.connect();
  try {
    const { schemaContract } = await import("../scripts/lib/schema-contract.cjs");
    const exported = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export", "--dialect=postgresql", "--schema=./src/db/schema.ts"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    await client.query("CREATE SCHEMA auth_contract");
    await client.query("SET search_path TO auth_contract");
    await client.query(exported.slice(exported.indexOf("CREATE TABLE")).replaceAll('"public".', '"auth_contract".'));
    await client.query("SET search_path TO public");
    const actual = await schemaContract(client, "public");
    const expected = await schemaContract(client, "auth_contract");
    assert.deepEqual(actual, expected);
    const source = JSON.parse(readFileSync("tmp/auth-review/database-report.json", "utf8"));
    const counts = (await client.query(`SELECT
      (SELECT count(*)::int FROM gallery_projects) AS projects,
      (SELECT count(*)::int FROM gallery_project_authors) AS authors,
      (SELECT count(*)::int FROM gallery_users WHERE is_demo) AS demos`)).rows[0];
    assert.equal(counts.projects, source.sourceCounts.gallery_projects);
    assert.equal(counts.authors, source.sourceCounts.gallery_project_authors);
    assert.equal(counts.demos, source.sourceCounts.gallery_users);
    checks.push("Cutover SQL matches canonical Drizzle schema and retains all demo profiles/projects/credits");
  } finally { await client.query("SET search_path TO public"); await client.query("DROP SCHEMA IF EXISTS auth_contract CASCADE"); client.release(); }
});

test("first administrator bootstrap is closed and uses one-time activation", async () => {
  const email = "fixture-first-admin@example.invalid";
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
  assert.equal(user.status, "active"); assert.equal(user.email_verified, true); assert.equal(user.role, "admin");
  await assert.rejects(() => provisioning.bootstrapAdmin("Other Administrator", "other-admin@example.invalid"));
  await assert.rejects(() => access.consumeAccessLink(token(reissued.url), nextPassword, nextPassword));
  checks.push("First-admin bootstrap, safe reissue, activation and bootstrap closure");
});

test("demo and public registration cannot create access; identity fields stay server-owned", async () => {
  assert.equal((await login("demo@toti.gallery", "TotiGaleria2025!")).status, 401);
  const open = await post("/sign-up/email", { name: "Intruder", email: "intruder@example.invalid", password, role: "admin", status: "active" });
  assert.ok(open.status >= 400);
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_users WHERE email='intruder@example.invalid'"))[0].n, 0);
  const [demo] = await sql("SELECT id FROM gallery_users WHERE is_demo ORDER BY id LIMIT 1");
  await assert.rejects(() => access.createAccessLink(adminId, demo.id, "password_reset"));
  await assert.rejects(() => provisioning.provisionStudent(adminId, "Demo takeover", "demo@toti.gallery", (undefined as unknown as string)));
  checks.push("Demo login/grants and arbitrary sign-up rejected");
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
  checks.push("Password validation, expired/revoked grants and atomic single-use redemption");
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
  checks.push("Recovery replaces credentials without replacing the user and revokes old sessions");
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
  checks.push("Mock Google callback activates the imported ID, revokes activation grants and shares one profile with optional credentials");
});

test("Google rejects unapproved, unverified, demo, suspended and state-less callbacks", async () => {
  const before = (await sql("SELECT count(*)::int AS n FROM gallery_users"))[0].n;
  let result = await googleLogin({ sub: "unknown-subject", email: "unknown@example.invalid", email_verified: true, name: "Unknown" });
  assert.ok(result.headers.get("location")?.includes("error="));
  assert.equal((await sql("SELECT count(*)::int AS n FROM gallery_users"))[0].n, before);
  const user = await student("google-denied");
  result = await googleLogin({ sub: "unverified-subject", email: user.email, email_verified: false, name: "Unverified" });
  assert.ok(result.headers.get("location")?.includes("error="));
  assert.equal((await sql("SELECT status FROM gallery_users WHERE id=$1", [user.id]))[0].status, "pending");
  result = await googleLogin({ sub: "demo-subject", email: "demo@toti.gallery", email_verified: true, name: "Demo" });
  assert.ok(result.headers.get("location")?.includes("error="));
  await sql("UPDATE gallery_users SET status='suspended' WHERE id=$1", [user.id]);
  result = await googleLogin({ sub: "suspended-subject", email: user.email, email_verified: true, name: "Suspended" });
  assert.ok(result.headers.get("location")?.includes("error="));
  const stateUser = await student("google-state");
  result = await googleLogin({ sub: "state-subject", email: stateUser.email, email_verified: true, name: "State" }, false);
  assert.ok(result.headers.get("location")?.includes("error="));
  assert.equal((await sql("SELECT status FROM gallery_users WHERE id=$1", [stateUser.id]))[0].status, "pending");
  checks.push("Mock callbacks reject unknown/unverified/demo/suspended identities and missing OAuth cookie/state binding");
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
  checks.push("Local-first Google linking keeps one account and rejects changed Google email binding");
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
  checks.push("Cross-origin sign-in and external callbacks rejected; PostgreSQL-backed throttling enforced");
});

test("suspended accounts cannot open new sessions or issue grants", async () => {
  const user = await student("suspended");
  const grant = await access.createAccessLink(adminId, user.id, "activation");
  await access.consumeAccessLink(token(grant.url), password, password);
  await sql("UPDATE gallery_users SET status='suspended' WHERE id=$1", [user.id]);
  assert.equal((await login(user.email)).status, 403);
  await assert.rejects(() => access.createAccessLink(adminId, user.id, "password_reset"));
  await assert.rejects(() => access.createAccessLink(user.id, adminId, "password_reset"));
  checks.push("Suspended users cannot log in/recover or create privileged access grants");
});

after(async () => {
  if (!pool) return;
  try {
    if (pool && userIds.size) {
      const ids = [...userIds];
      await sql("DELETE FROM gallery_invitations WHERE user_id=ANY($1::text[]) OR created_by=ANY($1::text[])", [ids]);
      await sql("DELETE FROM gallery_projects WHERE author_id=ANY($1::text[])", [ids]);
      await sql("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[])", [ids]);
      await sql("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [ids]);
      await sql("DELETE FROM gallery_auth_rate_limits");
    }
    const report = { checks, mockGoogleOnly: true, publicGoogleVerified: false, stage3Started: false, fixturesRemoved: !!pool && (await sql("SELECT count(*)::int AS n FROM gallery_users WHERE NOT is_demo"))[0].n === 0 };
    // The source DB is not imported into the app/test process; inspect it through
    // a separate read-only client to confirm it remains unchanged.
    const { Client } = await import("pg");
    const { parse } = await import("dotenv");
    const { snapshot, fingerprints } = await import("../scripts/lib/database-snapshot.cjs");
    const sourceEnv = parse(readFileSync(".env.test-source"));
    assertRuntimeTarget(sourceEnv.DATABASE_URL, sourceEnv);
    const source = new Client({ connectionString: sourceEnv.DATABASE_URL });
    await source.connect();
    try {
      await assertDatabaseTarget(source, sourceEnv, "test");
      const initial = JSON.parse(readFileSync("tmp/auth-review/database-report.json", "utf8"));
      const unchanged = JSON.stringify(fingerprints(await snapshot(source))) === JSON.stringify(initial.sourceFingerprints);
      assert.ok(unchanged, "Source database changed since preparation");
      writeFileSync("tmp/auth-review/auth-tests.json", JSON.stringify({ ...report, sourceUnchanged: unchanged }, null, 2) + "\n");
    } finally { await source.end(); }
  } finally { globalThis.fetch = realFetch; if (pool) await pool.end(); }
});
