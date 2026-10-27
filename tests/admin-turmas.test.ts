import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomInt, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { assertDatabaseTarget, assertRuntimeTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let service: typeof import("../src/lib/admin-turmas");
const userIds = new Set<string>(), groupIds = new Set<string>();
const prefix = `admin-fixture-${randomUUID()}`;
const turmaNumber = randomInt(1000000, 900000000);
let ownerId: string, adminId: string, studentId: string, suspendedId: string, groupId: string, secondId: string;
let baseline: Record<string, string>;
const hash = (rows: unknown[]) => createHash("sha256").update(JSON.stringify(rows.map(r => JSON.stringify(r)).sort())).digest("hex");
async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%'")).rows) result[tablename] = hash((await pool.query(`SELECT * FROM "${tablename}"`)).rows);
  return result;
}
async function fixture(role = "user", status = "active") {
  const id = randomUUID(); userIds.add(id);
  await pool.query("INSERT INTO gallery_users(id,name,email,role,status,email_verified) VALUES ($1,$2,$3,$4,$5,true)", [id, "Fixture Student", `${prefix}-${id}@example.invalid`, role, status]);
  return id;
}
before(async () => {
  config({ path: ".env.admin-test", override: true, quiet: true });
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  ({ pool } = await import("../src/db"));
  await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot();
  service = await import("../src/lib/admin-turmas");
  ownerId = (await pool.query("SELECT id FROM gallery_users WHERE role='owner'")).rows[0].id;
  adminId = await fixture("admin"); studentId = await fixture(); suspendedId = await fixture("admin", "suspended");
  groupId = (await service.saveTurma(ownerId, { number: turmaNumber, courseName: "Fixture Course", startYear: 2026 })).id; groupIds.add(groupId);
  secondId = (await service.saveTurma(adminId, { number: turmaNumber + 1, courseName: "Fixture Course", startYear: 2026 })).id; groupIds.add(secondId);
});
after(async () => {
  if (!pool) return;
  try {
    const ids = [...userIds];
    await pool.query("DELETE FROM gallery_invitations WHERE user_id=ANY($1::text[]) OR created_by=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM gallery_projects WHERE slug LIKE $1", [prefix + "%"]);
    await pool.query("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[]) OR turma_id=ANY($2::text[])", [ids, [...groupIds]]);
    await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM gallery_turmas WHERE id=ANY($1::text[])", [[...groupIds]]);
    if (baseline) assert.deepEqual(await snapshot(), baseline, "Original test-clone rows changed");
  } finally { await pool.end(); }
});

test("staff checks apply to every operation, including suspended administrators", async () => {
  for (const id of [studentId, suspendedId, randomUUID()]) {
    await assert.rejects(() => service.listTurmas(id), /restrito/);
    await assert.rejects(() => service.saveTurma(id, { number: turmaNumber + 2, courseName: "Denied", startYear: 2026 }), /restrito/);
    await assert.rejects(() => service.setMembership(id, groupId, studentId, true), /restrito/);
    await assert.rejects(() => service.importStudents(id, groupId, 'Ana,ana@example.invalid', [], true), /restrito/);
  }
  await assert.rejects(() => service.setMembership(adminId, groupId, ownerId, true), /não pode/);
  await assert.rejects(() => service.setMembership(adminId, groupId, adminId, true), /não pode/);
});
test("turma editing and archive preserve membership, publications, credits and likes", async () => {
  await service.setMembership(adminId, groupId, studentId, true);
  const projectId = randomUUID();
  await pool.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,is_final) VALUES ($1,$2,'Fixture','Fixture description','[]','https://github.com',$3,$4,true)", [projectId, prefix, studentId, groupId]);
  await pool.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES ($1,$2)", [projectId, studentId]);
  await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES ($1,'fixture-like')", [projectId]);
  await service.saveTurma(adminId, { number: turmaNumber, courseName: "Updated Course", startYear: 2027 }, groupId);
  await service.archiveTurma(adminId, groupId, true);
  let detail = await service.turmaDetails(ownerId, groupId);
  assert.equal(detail.turma.archived, true); assert.equal(detail.projects.length, 1); assert.equal(detail.members.length, 1);
  await service.setMembership(adminId, groupId, studentId, false);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_project_authors WHERE project_id=$1", [projectId])).rows[0].n, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_likes WHERE project_id=$1", [projectId])).rows[0].n, 1);
  await service.setMembership(adminId, groupId, studentId, true); // Archived groups remain usable.
  await service.archiveTurma(adminId, groupId, false);
  detail = await service.turmaDetails(ownerId, groupId);
  assert.equal(detail.turma.archived, false);
  await assert.rejects(() => service.saveTurma(adminId, { number: turmaNumber, courseName: "Duplicate Number", startYear: 2026 }));
  await assert.rejects(() => service.saveTurma(adminId, { number: -1, courseName: "a", startYear: 1900 }));
});
test("import preview is read-only; confirmation is atomic and preserves existing identities", async () => {
  const existing = (await pool.query("SELECT * FROM gallery_users WHERE id=$1", [studentId])).rows[0];
  const newEmail = `${prefix}-new@example.invalid`;
  const csv = `Nome,Email\nChanged name,${existing.email}\nNew Student,${newEmail}\nBad,bad`;
  const before = await snapshot();
  const preview = await service.importStudents(adminId, secondId, csv);
  assert.deepEqual(preview.preview.map(r => r.kind), ["existing", "new", "error"]);
  assert.deepEqual(await snapshot(), before);
  await assert.rejects(() => service.importStudents(adminId, secondId, csv, [], true), /Corrija/);
  assert.deepEqual(await snapshot(), before);
  const result = await service.importStudents(adminId, secondId, csv, [4], true);
  assert.equal(result.created, 1); assert.equal(result.linked, 2);
  const created = (await pool.query("SELECT * FROM gallery_users WHERE email=$1", [newEmail])).rows[0]; userIds.add(created.id);
  assert.equal(created.status, "pending"); assert.equal(created.role, "user"); assert.equal(created.email_verified, false);
  assert.deepEqual((await pool.query("SELECT * FROM gallery_users WHERE id=$1", [studentId])).rows[0], existing);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_turma_members WHERE user_id=$1", [studentId])).rows[0].n, 2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_auth_accounts WHERE user_id=$1", [created.id])).rows[0].n, 0);
  const again = await service.importStudents(adminId, secondId, csv, [4], true);
  assert.equal(again.created, 0); assert.equal(again.linked, 0); assert.equal(again.unchanged, 2);
});
test("owner can issue student links; admin cannot reset owner or another administrator", async () => {
  const { createAccessLink } = await import("../src/lib/access-links");
  const id = (await pool.query("SELECT id FROM gallery_users WHERE email=$1", [`${prefix}-new@example.invalid`])).rows[0].id;
  const grant = await createAccessLink(ownerId, id, "activation");
  assert.ok(grant.url.startsWith("http://localhost:3000/acesso#token="));
  await assert.rejects(() => createAccessLink(adminId, ownerId, "password_reset"));
  await assert.rejects(() => createAccessLink(adminId, adminId, "password_reset"));
  await assert.rejects(() => (import("../src/lib/admin-provision").then(m => m.bootstrapAdmin("Intruder", `${prefix}@example.invalid`))));
});
test("final migrated schema matches Drizzle and enforces a single owner", async () => {
  const client = await pool.connect();
  try {
    const { schemaContract } = await import("../scripts/lib/schema-contract.cjs");
    const ddl = execFileSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "export", "--dialect=postgresql", "--schema=./src/db/schema.ts"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    await client.query("CREATE SCHEMA admin_contract");
    await client.query("SET search_path TO admin_contract");
    await client.query(ddl.slice(ddl.indexOf("CREATE TABLE")).replaceAll('"public".', '"admin_contract".'));
    await client.query("SET search_path TO public");
    assert.deepEqual(await schemaContract(client, "public"), await schemaContract(client, "admin_contract"));
    await assert.rejects(() => client.query("UPDATE gallery_users SET role='owner' WHERE id=$1", [adminId]));
  } finally { await client.query("SET search_path TO public"); await client.query("DROP SCHEMA IF EXISTS admin_contract CASCADE"); client.release(); }
});

test("imports reject protected identities and serialize concurrent duplicates", async () => {
  const demo = (await pool.query("SELECT email FROM gallery_users WHERE is_demo LIMIT 1")).rows[0].email;
  const admin = (await pool.query("SELECT email FROM gallery_users WHERE id=$1", [adminId])).rows[0].email;
  const suspendedUser = await fixture("user", "suspended");
  const suspended = (await pool.query("SELECT email FROM gallery_users WHERE id=$1", [suspendedUser])).rows[0].email;
  const denied = await service.importStudents(ownerId, secondId, `Demo,${demo}\nAdmin,${admin}\nSuspended,${suspended}`);
  assert.deepEqual(denied.preview.map(r => r.kind), ["error", "error", "error"]);
  const email = `${prefix}-concurrent@example.invalid`;
  const csv = `Concurrent Student,${email}`;
  const results = await Promise.all([service.importStudents(adminId, secondId, csv, [], true), service.importStudents(ownerId, secondId, csv, [], true)]);
  const row = (await pool.query("SELECT id FROM gallery_users WHERE email=$1", [email])).rows[0]; userIds.add(row.id);
  assert.equal(results.reduce((n,r) => n + r.created, 0), 1);
  assert.equal(results.reduce((n,r) => n + r.linked, 0), 1);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_turma_members WHERE user_id=$1", [row.id])).rows[0].n, 1);
});

test("an invalid selected owner rolls back the complete schema migration", async () => {
  const client = await pool.connect();
  try {
    await client.query("CREATE SCHEMA owner_migration_fixture");
    await client.query("SET search_path TO owner_migration_fixture");
    await client.query("CREATE TABLE gallery_users(id text PRIMARY KEY, role text NOT NULL, status text NOT NULL, is_demo boolean NOT NULL, CONSTRAINT gallery_users_role_check CHECK(role IN ('user','admin')))");
    await client.query("INSERT INTO gallery_users VALUES ('first','admin','active',false),('student','user','active',false)");
    await client.query("SELECT set_config('gallery.owner_user_id','student',false)");
    const migration = (await import("node:fs")).readFileSync("migrations/20261027_stage3_owner.sql", "utf8");
    await assert.rejects(() => client.query(migration));
    await client.query("ROLLBACK");
    assert.equal((await client.query("SELECT role FROM gallery_users WHERE id='first'")).rows[0].role, "admin");
    assert.equal((await client.query("SELECT to_regclass('gallery_users_single_owner_idx') AS name")).rows[0].name, null);
    await client.query("SELECT set_config('gallery.owner_user_id','first',false)");
    await client.query(migration);
    assert.deepEqual((await client.query("SELECT id,role FROM gallery_users ORDER BY id")).rows, [{ id: "first", role: "owner" }, { id: "student", role: "user" }]);
  } finally { await client.query("ROLLBACK"); await client.query("SET search_path TO public"); await client.query("SELECT set_config('gallery.owner_user_id','',false)"); await client.query("DROP SCHEMA IF EXISTS owner_migration_fixture CASCADE"); client.release(); }
});


test("email lookup detects existing membership and manual addition preserves identity", async () => {
  const existing = (await pool.query("SELECT * FROM gallery_users WHERE id=$1", [studentId])).rows[0];
  const found = await service.lookupStudent(adminId, groupId, ` ${existing.email.toUpperCase()} `);
  assert.equal(found?.id, studentId); assert.equal(found?.member, true);
  const added = await service.addStudent(adminId, secondId, "Name must not change", existing.email);
  assert.equal(added.created, false); assert.equal(added.id, studentId);
  assert.deepEqual((await pool.query("SELECT * FROM gallery_users WHERE id=$1", [studentId])).rows[0], existing);
  const email = `${prefix}-manual@example.invalid`;
  assert.equal(await service.lookupStudent(adminId, groupId, email), null);
  const fresh = await service.addStudent(adminId, groupId, "Manual New Student", email); userIds.add(fresh.id);
  assert.equal(fresh.created, true); assert.equal(fresh.status, "pending");
});
