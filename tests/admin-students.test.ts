import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget, assertRuntimeTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let service: typeof import("../src/lib/admin-students");
const prefix = `students-fixture-${randomUUID()}`, ids = new Set<string>(), groupIds: string[] = [];
let admin: string, regular: string, pending: string, suspendedAdmin: string, demo: string, owner: string;
let baseline: Record<string, string>;
async function snapshot() {
  const hashes: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%'")).rows) {
    const rows = (await pool.query(`SELECT * FROM "${tablename}"`)).rows;
    hashes[tablename] = createHash("sha256").update(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return hashes;
}
async function fixture(status = "active", role = "user", isDemo = false, verified = status === "active"): Promise<string> {
  const id = randomUUID(); ids.add(id);
  await pool.query("INSERT INTO gallery_users(id,name,email,status,role,is_demo,email_verified) VALUES ($1,'Fixture Student',$2,$3,$4,$5,$6)", [id, `${prefix}-${id}@example.invalid`, status, role, isDemo, verified]);
  return id;
}
before(async () => {
  config({ path: ".env.admin-test", override: true, quiet: true });
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  ({ pool } = await import("../src/db")); await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot(); service = await import("../src/lib/admin-students");
  owner = (await pool.query("SELECT id FROM gallery_users WHERE role='owner'")).rows[0].id;
  admin = await fixture("active", "admin"); regular = await fixture(); pending = await fixture("pending");
  suspendedAdmin = await fixture("suspended", "admin"); demo = await fixture("active", "user", true);
  const { saveTurma } = await import("../src/lib/admin-turmas");
  const number = randomInt(1000000, 800000000);
  for (let i = 0; i < 2; i++) groupIds.push((await saveTurma(admin, { number: number + i, courseName: "Student Fixture", startYear: 2026 })).id);
  await pool.query("UPDATE gallery_turmas SET archived_at=now() WHERE id=$1", [groupIds[1]]);
});
after(async () => {
  if (!pool) return;
  try {
    const selected = [...ids];
    await pool.query("DELETE FROM gallery_invitations WHERE user_id=ANY($1::text[]) OR created_by=ANY($1::text[])", [selected]);
    await pool.query("DELETE FROM gallery_projects WHERE slug LIKE $1", [prefix + "%"]);
    await pool.query("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[]) OR turma_id=ANY($2::text[])", [selected, groupIds]);
    await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [selected]);
    await pool.query("DELETE FROM gallery_turmas WHERE id=ANY($1::text[])", [groupIds]);
    if (baseline) assert.deepEqual(await snapshot(), baseline, "Original isolated rows changed");
  } finally { await pool.end(); }
});

test("student listing includes unassigned users and enrolled staff, exposing grant metadata only", async () => {
  let rows = (await service.listStudents(admin)).students;
  assert.ok(rows.some(row => row.id === pending && row.turmaIds.length === 0));
  assert.ok(!rows.some(row => row.id === admin));
  await pool.query("INSERT INTO gallery_turma_members(turma_id,user_id) VALUES ($1,$2)", [groupIds[0], admin]);
  rows = (await service.listStudents(owner)).students;
  assert.ok(rows.some(row => row.id === admin));
  const grant = await service.studentAccessLink(admin, pending, "activation");
  const person = (await service.listStudents(admin)).students.find(row => row.id === pending)!;
  assert.equal(person.accessLink?.state, "valid"); assert.equal(person.accessLink?.expiresAt, grant.expiresAt);
  assert.ok(!JSON.stringify(person).includes("token")); assert.ok(!JSON.stringify(person).includes("password"));
});

test("each student operation enforces staff access and protects administrator accounts", async () => {
  for (const actor of [regular, suspendedAdmin, randomUUID()]) {
    await assert.rejects(() => service.listStudents(actor), /restrito/);
    await assert.rejects(() => service.updateStudentTurmas(actor, pending, groupIds), /restrito/);
    await assert.rejects(() => service.setStudentSuspended(actor, pending, true), /restrito/);
    await assert.rejects(() => service.studentAccessLink(actor, pending, "activation"), /restrito/);
    await assert.rejects(() => service.revokeStudentLink(actor, pending, randomUUID()), /restrito/);
    await assert.rejects(() => service.createStudentInvitations(actor, [pending]), /restrito/);
    await assert.rejects(() => service.updateStudentProfile(actor, pending, "Valid Name", `${prefix}@example.invalid`), /restrito/);
    await assert.rejects(() => service.deletePendingStudent(actor, pending), /restrito/);
  }
  await assert.rejects(() => service.updateStudentTurmas(admin, admin, []), /não pode/);
  await assert.rejects(() => service.studentAccessLink(admin, admin, "password_reset"), /não pode/);
  await assert.rejects(() => service.setStudentSuspended(owner, admin, true), /estudantes reais/);
  await assert.rejects(() => service.setStudentSuspended(owner, demo, true), /estudantes reais/);
  await assert.rejects(() => service.updateStudentProfile(admin, admin, "Valid Name", `${prefix}@example.invalid`), /não pode/);
  await assert.rejects(() => service.deletePendingStudent(admin, owner), /não pode/);
});

test("replacing multiple memberships, including no turma or archived turma, preserves credits and likes", async () => {
  await service.updateStudentTurmas(admin, regular, groupIds);
  const publication = randomUUID();
  await pool.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id) VALUES ($1,$2,'Fixture','Description','[]','https://github.com',$3,$4)", [publication, prefix, regular, groupIds[0]]);
  await pool.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES ($1,$2),($1,$3)", [publication, regular, pending]);
  await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES ($1,'fixture-like')", [publication]);
  const before = (await pool.query("SELECT * FROM gallery_projects WHERE id=$1", [publication])).rows[0];
  await service.updateStudentTurmas(admin, regular, []);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_turma_members WHERE user_id=$1", [regular])).rows[0].n, 0);
  await service.updateStudentTurmas(admin, regular, [groupIds[1]]);
  await assert.rejects(() => service.updateStudentTurmas(admin, regular, [groupIds[0], randomUUID()]));
  await assert.rejects(() => service.updateStudentTurmas(admin, regular, [groupIds[0], groupIds[0]]));
  assert.deepEqual((await pool.query("SELECT * FROM gallery_projects WHERE id=$1", [publication])).rows[0], before);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_project_authors WHERE project_id=$1", [publication])).rows[0].n, 2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_likes WHERE project_id=$1", [publication])).rows[0].n, 1);
});

test("suspension revokes sessions and grants; restoring preserves activation state and publication data", async () => {
  const grant = await service.studentAccessLink(admin, regular, "password_reset");
  await pool.query("INSERT INTO gallery_auth_sessions(id,user_id,token,expires_at) VALUES ($1,$2,$3,now()+interval '1 day')", [randomUUID(), regular, prefix]);
  const projects = (await pool.query("SELECT * FROM gallery_projects WHERE author_id=$1", [regular])).rows;
  await service.setStudentSuspended(admin, regular, true);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_auth_sessions WHERE user_id=$1", [regular])).rows[0].n, 0);
  assert.equal((await service.listStudents(admin)).students.find(row => row.id === regular)?.accessLink?.state, "revoked");
  await assert.rejects(() => service.studentAccessLink(admin, regular, "password_reset"));
  const { consumeAccessLink } = await import("../src/lib/access-links");
  await assert.rejects(() => consumeAccessLink(new URL(grant.url).hash.slice(7), "a sufficiently long password", "a sufficiently long password"));
  assert.equal((await service.setStudentSuspended(owner, regular, false)).status, "active");
  assert.deepEqual((await pool.query("SELECT * FROM gallery_projects WHERE author_id=$1", [regular])).rows, projects);
  await service.setStudentSuspended(admin, pending, true);
  assert.equal((await service.setStudentSuspended(admin, pending, false)).status, "pending");
});

test("invitation batches are atomic, replace earlier links and can be revoked individually", async () => {
  const second = await fixture("pending");
  const before = await snapshot();
  await assert.rejects(() => service.createStudentInvitations(admin, [pending, regular]));
  await assert.rejects(() => service.createStudentInvitations(admin, [pending, pending]));
  assert.deepEqual(await snapshot(), before);
  const grants = await service.createStudentInvitations(admin, [pending, second]);
  assert.equal(grants.length, 2);
  const old = (await service.listStudents(admin)).students.find(person => person.id === pending)!.accessLink!;
  await service.createStudentInvitations(owner, [pending]);
  assert.ok((await pool.query("SELECT revoked_at FROM gallery_invitations WHERE id=$1", [old.id])).rows[0].revoked_at);
  const current = (await service.listStudents(admin)).students.find(person => person.id === pending)!.accessLink!;
  await assert.rejects(() => service.revokeStudentLink(admin, second, current.id), /não encontrado/);
  await service.revokeStudentLink(admin, pending, current.id);
  assert.equal((await service.listStudents(admin)).students.find(person => person.id === pending)?.accessLink?.state, "revoked");
  await service.revokeStudentLink(admin, pending, current.id); // Idempotent retry.
});

test("concurrent activation and suspension cannot leave an account active", async () => {
  const id = await fixture("pending");
  const grant = await service.studentAccessLink(admin, id, "activation");
  const { consumeAccessLink } = await import("../src/lib/access-links");
  await Promise.allSettled([consumeAccessLink(new URL(grant.url).hash.slice(7), "a sufficiently long password", "a sufficiently long password"), service.setStudentSuspended(admin, id, true)]);
  assert.equal((await pool.query("SELECT status FROM gallery_users WHERE id=$1", [id])).rows[0].status, "suspended");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_invitations WHERE user_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL", [id])).rows[0].n, 0);
});

test("profile corrections retain identity; only pending email changes revoke old activation links", async () => {
  const id = await fixture("pending"), email = `${prefix}-corrected@example.invalid`;
  const grant = await service.studentAccessLink(admin, id, "activation");
  const before = (await pool.query("SELECT email FROM gallery_users WHERE id=$1", [id])).rows[0];
  await service.updateStudentProfile(admin, id, "Corrected Name", before.email);
  const { inspectAccessLink } = await import("../src/lib/access-links");
  const token = new URL(grant.url).hash.slice(7);
  assert.equal((await inspectAccessLink(token)).userId, id);
  const result = await service.updateStudentProfile(admin, id, "  Corrected Name  ", ` ${email.toUpperCase()} `);
  assert.deepEqual(result, { name: "Corrected Name", email, emailChanged: true });
  await assert.rejects(() => inspectAccessLink(token));
  assert.equal((await pool.query("SELECT id FROM gallery_users WHERE email=$1", [email])).rows[0].id, id);
  const fresh = await service.studentAccessLink(admin, id, "activation");
  assert.equal((await inspectAccessLink(new URL(fresh.url).hash.slice(7))).email, email);
  const duplicate = (await pool.query("SELECT email FROM gallery_users WHERE id=$1", [regular])).rows[0].email;
  await assert.rejects(() => service.updateStudentProfile(admin, id, "Must not save", duplicate), /já está cadastrado/);
  assert.equal((await pool.query("SELECT name FROM gallery_users WHERE id=$1", [id])).rows[0].name, "Corrected Name");
  assert.equal((await inspectAccessLink(new URL(fresh.url).hash.slice(7))).email, email);
  await assert.rejects(() => service.updateStudentProfile(admin, id, " ", email), /nome/);
  await assert.rejects(() => service.updateStudentProfile(admin, id, "Valid Name", "invalid"), /email/);
  const active = (await pool.query("SELECT * FROM gallery_users WHERE id=$1", [regular])).rows[0];
  await service.updateStudentProfile(admin, regular, "Updated Active Name", active.email);
  assert.equal((await pool.query("SELECT name FROM gallery_users WHERE id=$1", [regular])).rows[0].name, "Updated Active Name");
  await assert.rejects(() => service.updateStudentProfile(admin, regular, "Must not save", email), /antes da ativação/);
});

test("deletion removes only unactivated registrations with their memberships and invitations", async () => {
  const id = await fixture("pending");
  await service.updateStudentTurmas(admin, id, groupIds);
  const first = await service.studentAccessLink(admin, id, "activation");
  await service.studentAccessLink(admin, id, "activation");
  await service.deletePendingStudent(admin, id);
  for (const table of ["gallery_users", "gallery_turma_members", "gallery_invitations"]) {
    const column = table === "gallery_users" ? "id" : "user_id";
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${column}=$1`, [id])).rows[0].n, 0);
  }
  const { inspectAccessLink } = await import("../src/lib/access-links");
  await assert.rejects(() => inspectAccessLink(new URL(first.url).hash.slice(7)));
  await assert.rejects(() => service.deletePendingStudent(admin, id), /não encontrado/);
  for (const protectedId of [regular, demo, await fixture("suspended"), await fixture("pending", "user", false, true)]) {
    await assert.rejects(() => service.deletePendingStudent(admin, protectedId), /ainda não ativaram/);
  }
  await assert.rejects(() => service.deletePendingStudent(owner, admin), /ainda não ativaram/);
  // Earlier fixture intentionally has a pending coauthor to exercise legacy-data protection.
  const credits = (await pool.query("SELECT * FROM gallery_project_authors WHERE user_id=$1", [pending])).rows;
  await assert.rejects(() => service.deletePendingStudent(admin, pending), /histórico associado/);
  assert.deepEqual((await pool.query("SELECT * FROM gallery_project_authors WHERE user_id=$1", [pending])).rows, credits);
  const inconsistent = await fixture("pending");
  await pool.query("INSERT INTO gallery_auth_accounts(id,user_id,account_id,provider_id) VALUES ($1,$2,$2,'google')", [randomUUID(), inconsistent]);
  await assert.rejects(() => service.deletePendingStudent(admin, inconsistent), /histórico associado/);
});

test("public profiles require activation; suspension preserves activated profiles and demo content", async () => {
  const { getCommunityPeople, getPerson, getCoauthorCandidates } = await import("../src/lib/queries");
  const hidden = await fixture("pending"), example = await fixture("pending", "user", true);
  await service.updateStudentTurmas(admin, hidden, [groupIds[0]]);
  await service.updateStudentTurmas(admin, example, [groupIds[0]]);
  assert.equal(await getPerson(hidden), null);
  await service.setStudentSuspended(admin, hidden, true);
  assert.equal(await getPerson(hidden), null);
  assert.ok(!(await getCommunityPeople()).some(person => person.id === hidden));
  assert.ok(await getPerson(example));
  await service.setStudentSuspended(admin, regular, true);
  assert.ok(await getPerson(regular));
  await service.setStudentSuspended(admin, regular, false);
  const unverified = await fixture("active", "user", false, false);
  await service.updateStudentTurmas(admin, unverified, [groupIds[0]]);
  assert.ok(!(await getCoauthorCandidates(groupIds[0])).some(person => [hidden, example, unverified].includes(person.id)));
});

test("activation racing an email correction cannot verify a new email using an old invitation", async () => {
  const id = await fixture("pending"), email = `${prefix}-race@example.invalid`;
  const grant = await service.studentAccessLink(admin, id, "activation");
  const { consumeAccessLink } = await import("../src/lib/access-links");
  const results = await Promise.allSettled([
    consumeAccessLink(new URL(grant.url).hash.slice(7), "a sufficiently long password", "a sufficiently long password"),
    service.updateStudentProfile(admin, id, "Corrected Race", email),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const person = (await pool.query("SELECT email,status,email_verified FROM gallery_users WHERE id=$1", [id])).rows[0];
  assert.ok(person.email === email ? person.status === "pending" && !person.email_verified : person.status === "active" && person.email_verified);
});

test("activation racing deletion either preserves the activated account or removes only its pending registration", async () => {
  const id = await fixture("pending"), grant = await service.studentAccessLink(admin, id, "activation");
  const { consumeAccessLink } = await import("../src/lib/access-links");
  const results = await Promise.allSettled([
    consumeAccessLink(new URL(grant.url).hash.slice(7), "a sufficiently long password", "a sufficiently long password"),
    service.deletePendingStudent(admin, id),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const person = (await pool.query("SELECT status,email_verified FROM gallery_users WHERE id=$1", [id])).rows[0];
  if (person) { assert.equal(person.status, "active"); assert.equal(person.email_verified, true); }
  else assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_auth_accounts WHERE user_id=$1", [id])).rows[0].n, 0);
});

test("server pagination counts unique students, searches all pages and applies turma/access filters before limiting", async () => {
  const scope = `${prefix}-pages`;
  const records = Array.from({ length: 61 }, (_, index) => {
    const id = randomUUID(); ids.add(id);
    return { id, name: `${scope} ${String(index).padStart(2, "0")} João`, email: `${scope}-${index}@example.invalid`, status: index % 2 ? "active" : "pending", demo: index === 2 };
  });
  await pool.query("INSERT INTO gallery_users(id,name,email,status,is_demo,email_verified) SELECT * FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::boolean[],$6::boolean[])", [records.map(r => r.id), records.map(r => r.name), records.map(r => r.email), records.map(r => r.status), records.map(r => r.demo), records.map(r => r.status === "active")]);
  const memberships = records.flatMap((record, index) => [...(index < 30 ? [[groupIds[0], record.id]] : []), ...(index % 3 === 0 ? [[groupIds[1], record.id]] : [])]);
  await pool.query("INSERT INTO gallery_turma_members(turma_id,user_id) SELECT * FROM unnest($1::text[],$2::text[])", [memberships.map(m => m[0]), memberships.map(m => m[1])]);
  const first = await service.listStudents(admin, { query: scope });
  const second = await service.listStudents(admin, { query: scope, page: 2 });
  const third = await service.listStudents(admin, { query: scope, page: 3 });
  assert.equal(first.total, 61); assert.equal(first.students.length, 25); assert.equal(second.students.length, 25); assert.equal(third.students.length, 11);
  assert.equal(new Set([...first.students, ...second.students, ...third.students].map(person => person.id)).size, 61);
  assert.deepEqual((await service.listStudents(admin, { query: scope, page: 2 })).students.map(person => person.id), second.students.map(person => person.id));
  const larger = await service.listStudents(admin, { query: scope, pageSize: 50, page: 2 });
  assert.equal(larger.students.length, 11); assert.equal(larger.total, 61);
  const search = await service.listStudents(admin, { query: `${scope} 60 joao` });
  assert.equal(search.total, 1); assert.equal(search.students[0].id, records[60].id);
  assert.equal((await service.listStudents(admin, { query: scope, turmaId: groupIds[0] })).total, 30);
  assert.equal((await service.listStudents(admin, { query: scope, turmaId: groupIds[1] })).total, 21);
  assert.equal((await service.listStudents(admin, { query: scope, turmaId: "none" })).total, 20);
  assert.equal((await service.listStudents(admin, { query: scope, status: "pending" })).total, 30);
  assert.equal((await service.listStudents(admin, { query: scope, status: "demo" })).total, 1);
  assert.equal((await service.listStudents(admin, { query: scope, page: 9999 })).filters.page, 3);
  const empty = await service.listStudents(admin, { query: "no-match-" + scope, page: 9999 });
  assert.equal(empty.total, 0); assert.equal(empty.filters.page, 1); assert.deepEqual(empty.students, []);
  assert.equal((await service.listStudents(admin, { query: "%" + scope })).total, 0, "Percent characters must not act as wildcards");
  const { findStudentCandidates } = await import("../src/lib/admin-turmas");
  const candidates = await findStudentCandidates(admin, groupIds[0], scope);
  assert.equal(candidates.length, 25);
  assert.ok(!candidates.some(person => records.slice(0, 30).some(member => member.id === person.id)));
  assert.equal((await findStudentCandidates(admin, groupIds[0], `${scope} 60 joao`))[0].id, records[60].id);
  await assert.rejects(() => findStudentCandidates(regular, groupIds[0], scope), /restrito/);
});

test("student list URLs preserve filters and normalize invalid pagination parameters", async () => {
  const { parseStudentListParams, studentListHref } = await import("../src/lib/student-list-params");
  const parsed = parseStudentListParams({ q: " João ", turma: groupIds[0], status: "pending", page: "2", pageSize: "50" });
  const url = new URL(studentListHref(parsed), "https://example.invalid");
  assert.deepEqual(parseStudentListParams(Object.fromEntries(url.searchParams)), parsed);
  for (const page of ["-1", "0", "2.5", "Infinity", ["1", "2"], Number.MAX_SAFE_INTEGER + 1]) assert.equal(parseStudentListParams({ page }).page, 1);
  assert.equal(parseStudentListParams({ status: "owner", pageSize: "500" }).pageSize, 25);
  assert.equal(parseStudentListParams({ status: "owner" }).status, "all");
});
