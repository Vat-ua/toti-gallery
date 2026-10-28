import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget, assertRuntimeTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let service: typeof import("../src/lib/admin-administrators");
let owner: string, regular: string, admin: string, suspendedAdmin: string, demo: string;
const prefix = `administrators-fixture-${randomUUID()}`, ids = new Set<string>(), groupIds: string[] = [];
let baseline: Record<string, string>;

async function snapshot() {
  const hashes: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%'")).rows) {
    const rows = (await pool.query(`SELECT * FROM "${tablename}"`)).rows;
    hashes[tablename] = createHash("sha256").update(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return hashes;
}
async function fixture(status = "active", role = "user", isDemo = false) {
  const id = randomUUID(); ids.add(id);
  await pool.query("INSERT INTO gallery_users(id,name,email,status,role,is_demo,email_verified,bio,github) VALUES ($1,'Fixture Person',$2,$3,$4,$5,$6,'Keep bio','https://github.com')", [id, `${prefix}-${id}@example.invalid`, status, role, isDemo, status === "active"]);
  return id;
}
async function create(name: string, email: string) {
  const person = await service.createAdministrator(owner, name, email); ids.add(person.id); return person;
}
const token = (url: string) => new URL(url).hash.slice(7);

before(async () => {
  config({ path: ".env.admin-test", override: true, quiet: true });
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  ({ pool } = await import("../src/db"));
  await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot();
  service = await import("../src/lib/admin-administrators");
  const owners = (await pool.query("SELECT id FROM gallery_users WHERE role='owner' AND status='active' AND NOT is_demo")).rows;
  assert.equal(owners.length, 1, "Prepare an isolated database with its existing owner");
  owner = owners[0].id;
  regular = await fixture(); admin = await fixture("active", "admin");
  suspendedAdmin = await fixture("suspended", "admin"); demo = await fixture("active", "user", true);
});

after(async () => {
  if (!pool) return;
  try {
    const selected = [...ids];
    await pool.query("DELETE FROM gallery_invitations WHERE user_id=ANY($1::text[]) OR created_by=ANY($1::text[])", [selected]);
    await pool.query("DELETE FROM gallery_projects WHERE slug LIKE $1", [prefix + "%"]);
    await pool.query("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[])", [selected]);
    await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [selected]);
    await pool.query("DELETE FROM gallery_turmas WHERE id=ANY($1::text[])", [groupIds]);
    if (baseline) assert.deepEqual(await snapshot(), baseline, "Original isolated rows changed");
  } finally { await pool.end(); }
});

test("all administrator services require a current active non-demo owner", async () => {
  for (const actor of [regular, admin, suspendedAdmin, demo, randomUUID()]) {
    await assert.rejects(() => service.listAdministrators(actor), /restrito/);
    await assert.rejects(() => service.findAdministratorCandidates(actor, "fixture"), /restrito/);
    await assert.rejects(() => service.createAdministrator(actor, "Valid Name", `${prefix}@example.invalid`), /restrito/);
    await assert.rejects(() => service.promoteAdministrator(actor, regular), /restrito/);
    await assert.rejects(() => service.removeAdministrator(actor, admin), /restrito/);
    await assert.rejects(() => service.administratorAccessLink(actor, admin, "password_reset"), /restrito/);
    await assert.rejects(() => service.revokeAdministratorLink(actor, admin, randomUUID()), /restrito/);
  }
  const before = await snapshot();
  await assert.rejects(() => service.removeAdministrator(owner, owner), /protegida/);
  await assert.rejects(() => service.promoteAdministrator(owner, owner), /protegida/);
  await assert.rejects(() => service.administratorAccessLink(owner, owner, "password_reset"), /protegida/);
  await assert.rejects(() => service.revokeAdministratorLink(owner, owner, randomUUID()), /protegida/);
  assert.deepEqual(await snapshot(), before);
});

test("new staff registration is pending without turma or credentials and provides a single-use activation grant", async () => {
  const email = `${prefix}-new@example.invalid`;
  const person = await create("  New Staff  ", ` ${email.toUpperCase()} `);
  const row = (await pool.query("SELECT * FROM gallery_users WHERE id=$1", [person.id])).rows[0];
  assert.equal(row.email, email); assert.equal(row.name, "New Staff");
  assert.equal(row.role, "admin"); assert.equal(row.status, "pending"); assert.equal(row.email_verified, false);
  for (const table of ["gallery_turma_members", "gallery_auth_accounts"]) assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`, [person.id])).rows[0].n, 0);
  const { inspectAccessLink, consumeAccessLink } = await import("../src/lib/access-links");
  const inspected = await inspectAccessLink(token(person.grant.url));
  assert.equal(inspected.userId, person.id); assert.equal(inspected.purpose, "activation");
  const ttl = Date.parse(person.grant.expiresAt) - Date.now();
  assert.ok(ttl > 47 * 3600_000 && ttl <= 48 * 3600_000);
  await assert.rejects(() => create("Duplicate", email.toUpperCase()), /já tem um perfil/);
  await consumeAccessLink(token(person.grant.url), "a sufficiently long password", "a sufficiently long password");
  await assert.rejects(() => inspectAccessLink(token(person.grant.url)));
  const activated = (await pool.query("SELECT id,role,status,email_verified FROM gallery_users WHERE id=$1", [person.id])).rows[0];
  assert.deepEqual(activated, { id: person.id, role: "admin", status: "active", email_verified: true });
});

test("list and search expose eligible profiles and latest grant metadata without credentials or bearer tokens", async () => {
  const pending = await fixture("pending"), suspended = await fixture("suspended");
  const grant = await service.administratorAccessLink(owner, admin, "password_reset");
  const rows = await service.listAdministrators(owner);
  assert.equal(rows[0].id, owner); assert.equal(rows[0].accessLink, null);
  const person = rows.find(row => row.id === admin)!;
  assert.equal(person.accessLink?.state, "valid");
  assert.equal(person.accessLink?.expiresAt, grant.expiresAt);
  assert.ok(!JSON.stringify(rows).includes(token(grant.url)));
  assert.ok(!JSON.stringify(rows).includes("password" + '\":'));
  assert.ok(!rows.some(row => row.id === regular));
  const candidates = await service.findAdministratorCandidates(owner, prefix);
  assert.ok(candidates.some(row => row.id === regular)); assert.ok(candidates.some(row => row.id === pending));
  for (const id of [owner, admin, demo, suspended]) assert.ok(!candidates.some(row => row.id === id));
  assert.deepEqual(await service.findAdministratorCandidates(owner, "x"), []);
  assert.deepEqual(await service.findAdministratorCandidates(owner, "%_\\'"), []);
});

test("promoting and removing staff preserve the same profile, credentials, memberships, project authorship and likes", async () => {
  const user = await fixture(), project = randomUUID(), group = randomUUID(); groupIds.push(group);
  const number = randomInt(1000000, 800000000);
  await pool.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year) VALUES ($1,$2,$3,'Fixture',2026)", [group, `Turma ${number}`, number]);
  await pool.query("INSERT INTO gallery_turma_members(turma_id,user_id) VALUES ($1,$2)", [group, user]);
  await pool.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id) VALUES ($1,$2,'Fixture','Description','[]','https://github.com',$3,$4)", [project, prefix, user, group]);
  await pool.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES ($1,$2),($1,$3)", [project, user, regular]);
  await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES ($1,'fixture-like')", [project]);
  await pool.query("INSERT INTO gallery_auth_accounts(id,user_id,provider_id,account_id,password) VALUES ($1,$2,'credential',$2,'fixture-hash')", [randomUUID(), user]);
  const { studentAccessLink } = await import("../src/lib/admin-students");
  const previous = await studentAccessLink(admin, user, "password_reset");
  const { inspectAccessLink } = await import("../src/lib/access-links");
  async function content() {
    const result: Record<string, unknown> = {};
    for (const table of ["gallery_projects", "gallery_project_authors", "gallery_likes", "gallery_turma_members", "gallery_auth_accounts"]) result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1,2`)).rows;
    result.profile = (await pool.query("SELECT id,name,email,avatar,bio,github,status,email_verified FROM gallery_users WHERE id=$1", [user])).rows[0];
    return result;
  }
  const before = await content();
  await pool.query("INSERT INTO gallery_auth_sessions(id,user_id,token,expires_at) VALUES ($1,$2,$3,now()+interval '1 day')", [randomUUID(), user, randomUUID()]);
  const promotion = await service.promoteAdministrator(owner, user);
  assert.equal(promotion.id, user); assert.equal(promotion.grant, null);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_auth_sessions WHERE user_id=$1", [user])).rows[0].n, 0);
  await assert.rejects(() => inspectAccessLink(token(previous.url)));
  const reset = await service.administratorAccessLink(owner, user, "password_reset");
  await pool.query("INSERT INTO gallery_auth_sessions(id,user_id,token,expires_at) VALUES ($1,$2,$3,now()+interval '1 day')", [randomUUID(), user, randomUUID()]);
  await service.removeAdministrator(owner, user);
  await assert.rejects(() => inspectAccessLink(token(reset.url)));
  assert.equal((await pool.query("SELECT role FROM gallery_users WHERE id=$1", [user])).rows[0].role, "user");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_auth_sessions WHERE user_id=$1", [user])).rows[0].n, 0);
  assert.deepEqual(await content(), before);
  await assert.rejects(() => service.listAdministrators(user), /restrito/);
  const { listTurmas } = await import("../src/lib/admin-turmas");
  await assert.rejects(() => listTurmas(user), /restrito/);
  await assert.rejects(() => service.removeAdministrator(owner, user), /não é administradora/);
});

test("pending promotion replaces old student activation and serializes concurrent role changes", async () => {
  const user = await fixture("pending");
  const { studentAccessLink } = await import("../src/lib/admin-students");
  const old = await studentAccessLink(admin, user, "activation");
  const attempts = await Promise.allSettled([service.promoteAdministrator(owner, user), service.promoteAdministrator(owner, user)]);
  assert.equal(attempts.filter(row => row.status === "fulfilled").length, 1);
  const result = attempts.find(row => row.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof service.promoteAdministrator>>>;
  assert.ok(result.value.grant);
  const { inspectAccessLink } = await import("../src/lib/access-links");
  await assert.rejects(() => inspectAccessLink(token(old.url)));
  assert.equal((await inspectAccessLink(token(result.value.grant!.url))).userId, user);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_invitations WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL", [user])).rows[0].n, 1);
});

test("staff grant reissue, revocation and concurrent demotion cannot leave privileged access behind", async () => {
  const person = await create("Pending Staff", `${prefix}-links@example.invalid`);
  const next = await service.administratorAccessLink(owner, person.id, "activation");
  const { inspectAccessLink } = await import("../src/lib/access-links");
  await assert.rejects(() => inspectAccessLink(token(person.grant.url)));
  const current = (await service.listAdministrators(owner)).find(p => p.id === person.id)!.accessLink!;
  await assert.rejects(() => service.revokeAdministratorLink(owner, admin, current.id), /não encontrado/);
  await service.revokeAdministratorLink(owner, person.id, current.id);
  await assert.rejects(() => inspectAccessLink(token(next.url)));
  await service.revokeAdministratorLink(owner, person.id, current.id);
  await Promise.allSettled([service.administratorAccessLink(owner, person.id, "activation"), service.removeAdministrator(owner, person.id)]);
  assert.equal((await pool.query("SELECT role FROM gallery_users WHERE id=$1", [person.id])).rows[0].role, "user");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_invitations WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL", [person.id])).rows[0].n, 0);
  await assert.rejects(() => service.administratorAccessLink(owner, person.id, "activation"), /não é administradora/);
});

test("registration rejects duplicates and invalid or ineligible profiles without changing access", async () => {
  const suspended = await fixture("suspended");
  const before = await snapshot();
  for (const id of [demo, suspended, admin]) await assert.rejects(() => service.promoteAdministrator(owner, id), /perfil real/);
  await assert.rejects(() => service.promoteAdministrator(owner, null), /perfil válido/);
  await assert.rejects(() => service.createAdministrator(owner, "x", "not-email"), /nome/);
  await assert.rejects(() => service.createAdministrator(owner, "Good Name", null), /email/);
  assert.deepEqual(await snapshot(), before);
  const results = await Promise.allSettled([create("Concurrent Staff", `${prefix}-duplicate@example.invalid`), create("Concurrent Staff", `${prefix}-duplicate@example.invalid`)]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
});
