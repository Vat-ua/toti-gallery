import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createRequire } from "node:module";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let students: typeof import("../src/lib/admin-students");
let groups: typeof import("../src/lib/admin-turmas");
let studentRoute: typeof import("../src/app/api/admin/estudantes/[id]/route");
let turmaRoute: typeof import("../src/app/api/admin/turmas/[id]/route");
let restoreAuthentication: (() => void) | undefined;
const extraUsers: string[] = [];
const admin = randomUUID(), student = randomUUID(), turmaIds = [randomUUID(), randomUUID()];
let owner: string, baseline: Record<string, string>;
async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows) {
    result[tablename] = createHash("sha256").update(JSON.stringify((await pool.query(`SELECT * FROM "${tablename}"`)).rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return result;
}
before(async () => {
  const loaded = config({ path: process.env.GALLERY_ADMIN_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  if (loaded.error) throw new Error("Select an isolated admin test environment.");
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  ({ pool } = await import("../src/db")); await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot();
  students = await import("../src/lib/admin-students"); groups = await import("../src/lib/admin-turmas");
  // Keep the actual route, HTTP adapter and operation. The operation still
  // checks this fixture actor's live role/status inside its real transaction.
  const require = createRequire(`${process.cwd()}/package.json`);
  const authPath = require.resolve("./src/lib/auth.ts"), original = require.cache[authPath];
  require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: {
    isSameOrigin: (request: Request) => request.headers.get("origin") === "http://localhost:3101",
    getCurrentUser: async () => ({ id: admin, role: "admin" }),
  } } as NodeJS.Module;
  restoreAuthentication = () => { if (original) require.cache[authPath] = original; else delete require.cache[authPath]; };
  studentRoute = require("./src/app/api/admin/estudantes/[id]/route.ts");
  turmaRoute = require("./src/app/api/admin/turmas/[id]/route.ts");
  owner = (await pool.query("SELECT id FROM gallery_users WHERE role='owner'")).rows[0].id;
  for (const [id, role] of [[admin, "admin"], [student, "user"]]) {
    await pool.query("INSERT INTO gallery_users(id,name,email,role,status,email_verified) VALUES($1,'Concurrency fixture',$2,$3,'active',true)", [id, `${id}@example.invalid`, role]);
  }
  const number = randomInt(1000000, 800000000);
  for (const [index, id] of turmaIds.entries()) await pool.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year) VALUES($1,$2,$3,'Fixture',2026)", [id, `Turma ${number + index}`, number + index]);
});
after(async () => {
  if (!pool) return;
  try {
    if (baseline) {
      await pool.query("DELETE FROM gallery_invitations WHERE user_id=ANY($1::text[]) OR created_by=ANY($1::text[])", [[admin, student, ...extraUsers]]);
      await pool.query("DELETE FROM gallery_turma_members WHERE turma_id=ANY($1::text[])", [turmaIds]);
      await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [[admin, student, ...extraUsers]]);
      await pool.query("DELETE FROM gallery_turmas WHERE id=ANY($1::text[])", [turmaIds]);
      assert.deepEqual(await snapshot(), baseline, "Original isolated rows changed");
    }
  } finally { restoreAuthentication?.(); await pool.end(); }
});
async function memberships(id: string = student) {
  return (await pool.query("SELECT turma_id FROM gallery_turma_members WHERE user_id=$1 ORDER BY turma_id", [id])).rows.map(row => row.turma_id as string);
}
async function updateViaHttp(body: Record<string, unknown>) {
  return studentRoute.POST(new Request(`http://localhost:3101/api/admin/estudantes/${student}`, {
    method: "POST", headers: { origin: "http://localhost:3101", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "turmas", ...body }),
  }), { params: Promise.resolve({ id: student }) });
}
// Queue both requests behind the same row before releasing them. No arbitrary
// sleeps decide the race: PostgreSQL reports both waiters on the held lock.
async function raceOnUser(id: string, operations: (() => Promise<unknown>)[], table: "gallery_users" | "gallery_turmas" = "gallery_users") {
  const gate = await pool.connect();
  let work: Promise<unknown>[] = [];
  try {
    await gate.query("BEGIN");
    const pid = (await gate.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    await gate.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
    work = operations.map(operation => operation());
    // Attach rejection handlers immediately while arranging the race.
    const results = Promise.allSettled(work);
    const deadline = Date.now() + 15000;
    let waiters = 0;
    while (Date.now() < deadline) {
      waiters = (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>$1 AND cardinality(pg_blocking_pids(pid))>0 AND datname=current_database()", [pid])).rows[0].n;
      if (waiters === operations.length) break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal(waiters, operations.length, "Both operations must reach the held row lock");
    await gate.query("COMMIT");
    return await results;
  } finally { await gate.query("ROLLBACK"); gate.release(); await Promise.allSettled(work); }
}

test("concurrent owner self-membership updates complete without a lock-upgrade deadlock", async () => {
  const results = await raceOnUser(owner, turmaIds.map(id => () => groups.setMembership(owner, id, owner, true)));
  assert.deepEqual(results.map(result => result.status), ["fulfilled", "fulfilled"], JSON.stringify(results.map(result => result.status === "rejected" ? { code: result.reason.cause?.code || result.reason.code } : { ok: true })));
  const own = await memberships(owner);
  assert(turmaIds.every(id => own.includes(id)));
});

test("two administrative profile replacements from one snapshot preserve the first accepted edit", async () => {
  const expected = (await pool.query("SELECT name,email FROM gallery_users WHERE id=$1", [student])).rows[0];
  const results = await raceOnUser(student, [admin, owner].map((actor, index) => () => students.updateStudentProfile(actor, student, `Editor ${index}`, expected.email, expected)));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((results.find(result => result.status === "rejected") as PromiseRejectedResult).reason.status, 409);
  const winner = results.findIndex(result => result.status === "fulfilled");
  assert.equal((await pool.query("SELECT name FROM gallery_users WHERE id=$1", [student])).rows[0].name, `Editor ${winner}`);
});

test("two turma replacements from one snapshot lock the group and reject the stale writer", async () => {
  const id = turmaIds[0], expected = (await pool.query('SELECT number,course_name AS "courseName",start_year AS "startYear" FROM gallery_turmas WHERE id=$1', [id])).rows[0];
  const results = await raceOnUser(id, [admin, owner].map((actor, index) => () => groups.saveTurma(actor, { ...expected, courseName: `Course ${index}` }, id, expected)), "gallery_turmas");
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal((results.find(result => result.status === "rejected") as PromiseRejectedResult).reason.status, 409);
  const winner = results.findIndex(result => result.status === "fulfilled");
  assert.equal((await pool.query("SELECT course_name FROM gallery_turmas WHERE id=$1", [id])).rows[0].course_name, `Course ${winner}`);
});

test("profile and turma HTTP edits require valid snapshots and return 409 only for stale data", async () => {
  const person = (await pool.query("SELECT name,email FROM gallery_users WHERE id=$1", [student])).rows[0];
  const turmaId = turmaIds[0], group = (await pool.query('SELECT number,course_name AS "courseName",start_year AS "startYear" FROM gallery_turmas WHERE id=$1', [turmaId])).rows[0];
  async function saveGroup(expected: unknown) {
    return turmaRoute.PATCH(new Request(`http://localhost:3101/api/admin/turmas/${turmaId}`, {
      method: "PATCH", headers: { origin: "http://localhost:3101", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", ...group, courseName: "HTTP course", expected }),
    }), { params: Promise.resolve({ id: turmaId }) });
  }
  const before = await snapshot();
  for (const expected of [undefined, null, [], {}, { name: 42, email: person.email }, { ...person, role: "owner" }]) {
    assert.equal((await updateViaHttp({ action: "profile", ...person, name: "Must not save", expected })).status, 400);
  }
  for (const expected of [undefined, null, [], {}, { ...group, number: "51" }, { ...group, archived: false }]) {
    assert.equal((await saveGroup(expected)).status, 400);
  }
  assert.deepEqual(await snapshot(), before);
  assert.equal((await updateViaHttp({ action: "profile", ...person, name: "Current HTTP name", expected: person })).status, 200);
  assert.equal((await saveGroup(group)).status, 200);
  const accepted = await snapshot();
  const staleProfile = await updateViaHttp({ action: "profile", ...person, expected: person });
  const staleGroup = await saveGroup(group);
  for (const response of [staleProfile, staleGroup]) { assert.equal(response.status, 409); assert.equal(response.headers.get("cache-control"), "no-store"); }
  assert.deepEqual(await snapshot(), accepted);
});

test("turma snapshots accept legacy null fields and ignore archiving and membership changes", async () => {
  const id = turmaIds[1];
  await pool.query("UPDATE gallery_turmas SET course_name=NULL,start_year=NULL WHERE id=$1", [id]);
  const expected = (await pool.query('SELECT number,course_name AS "courseName",start_year AS "startYear" FROM gallery_turmas WHERE id=$1', [id])).rows[0];
  await groups.archiveTurma(admin, id, true);
  await groups.setMembership(admin, id, student, true);
  await groups.saveTurma(admin, { number: expected.number, courseName: "Restored course", startYear: 2026 }, id, expected);
  const stored = (await groups.turmaDetails(admin, id)).turma;
  assert.equal(stored.courseName, "Restored course"); assert.equal(stored.archived, true);
  assert((await memberships()).includes(id));
});

test("two membership replacements based on one snapshot cannot silently overwrite each other", async () => {
  await students.updateStudentTurmas(admin, student, []);
  const expected = { turmaIds: [], primaryTurmaId: null };
  const results = await raceOnUser(student, turmaIds.map(id => () => Reflect.apply(students.updateStudentTurmas, undefined, [admin, student, [id], null, expected])));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.status, 409);
  assert.equal((await memberships()).length, 1);
});

test("a stale whole-list save preserves a concurrently added membership", async () => {
  await students.updateStudentTurmas(admin, student, [turmaIds[0]]);
  await groups.setMembership(owner, turmaIds[1], student, true);
  await assert.rejects(() => Reflect.apply(students.updateStudentTurmas, undefined, [admin, student, [turmaIds[0]], null, { turmaIds: [turmaIds[0]], primaryTurmaId: null }]), error => (error as { status?: number }).status === 409);
  assert.deepEqual(await memberships(), [...turmaIds].sort());
});

test("a changed primary turma also invalidates an old membership snapshot", async () => {
  await students.updateStudentTurmas(admin, student, turmaIds, turmaIds[0]);
  await students.updateStudentTurmas(owner, student, turmaIds, turmaIds[1]);
  await assert.rejects(() => students.updateStudentTurmas(admin, student, turmaIds, turmaIds[0], { turmaIds, primaryTurmaId: turmaIds[0] }), error => (error as { status?: number }).status === 409);
  assert.equal((await pool.query("SELECT primary_turma_id FROM gallery_users WHERE id=$1", [student])).rows[0].primary_turma_id, turmaIds[1]);
  await assert.rejects(() => students.updateStudentTurmas(admin, student, turmaIds, null, { turmaIds: [1], primaryTurmaId: null }));
});

test("turma details fetch only enrolled profiles and candidate search remains scoped", async () => {
  await groups.setMembership(admin, turmaIds[0], student, true);
  const result = await groups.turmaDetails(admin, turmaIds[0]);
  assert(result.members.some(person => person.id === student));
  assert(!result.members.some(person => person.id === admin));
  assert(!("candidates" in result));
  const candidates = await groups.findStudentCandidates(admin, turmaIds[0], "Concurrency fixture");
  assert(!candidates.some(person => person.id === student || person.id === owner || person.id === admin));
});

test("turma access checks membership inside the write transaction", async () => {
  await groups.setMembership(admin, turmaIds[0], student, false);
  const before = await snapshot();
  await assert.rejects(() => groups.turmaAccessLink(admin, turmaIds[0], student, "password_reset"), error => (error as { status?: number }).status === 404);
  assert.deepEqual(await snapshot(), before);
  await groups.setMembership(admin, turmaIds[0], student, true);
  const granted = await groups.turmaAccessLink(admin, turmaIds[0], student, "password_reset");
  assert.match(granted.url, /\/acesso#token=[a-f0-9]{64}$/);
  // This fixture has issued grants, which must be removed before its user.
  await pool.query("DELETE FROM gallery_invitations WHERE user_id=$1", [student]);
});

test("batch import rolls back inserted profiles when membership insertion fails", async () => {
  const tag = randomUUID(), email = `${tag}@example.invalid`, name = `batch_failure_${tag.replaceAll("-", "")}`;
  const before = await snapshot();
  await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.turma_id='${turmaIds[1]}' THEN RAISE EXCEPTION 'fixture membership failure'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${name} BEFORE INSERT ON gallery_turma_members FOR EACH ROW EXECUTE FUNCTION ${name}()`);
  try {
    await assert.rejects(() => groups.importStudents(admin, turmaIds[1], `Rollback Fixture,${email}`, [], true));
    assert.equal((await pool.query("SELECT id FROM gallery_users WHERE email=$1", [email])).rowCount, 0);
    assert.deepEqual(await snapshot(), before);
  } finally {
    await pool.query(`DROP TRIGGER ${name} ON gallery_turma_members`);
    await pool.query(`DROP FUNCTION ${name}()`);
  }
});

test("batch slug allocation handles duplicate names and suffix-shaped names without changing existing users", async () => {
  const tag = randomUUID(), emails = [0, 1, 2].map(i => `${tag}-${i}@example.invalid`), base = `Batch ${tag}`;
  try {
    const result = await groups.importStudents(admin, turmaIds[1], `${base},${emails[0]}\n${base},${emails[1]}\n${base} 2,${emails[2]}`, [], true);
    assert.equal(result.created, 3); assert.equal(result.linked, 3);
    const rows = (await pool.query("SELECT id,slug FROM gallery_users WHERE email=ANY($1::text[])", [emails])).rows;
    assert.equal(new Set(rows.map(row => row.slug)).size, 3);
    const again = await groups.importStudents(owner, turmaIds[1], emails.map(email => `Do not rename,${email}`).join("\n"), [], true);
    assert.equal(again.created, 0); assert.equal(again.unchanged, 3);
    assert.equal((await pool.query("SELECT id FROM gallery_users WHERE email=ANY($1::text[]) AND name='Do not rename'", [emails])).rowCount, 0);
  } finally { extraUsers.push(...(await pool.query("SELECT id FROM gallery_users WHERE email=ANY($1::text[])", [emails])).rows.map(row => row.id)); }
});

test("HTTP rejects missing expected state with 400 and preserves existing memberships", async () => {
  // A trusted direct call can still omit the snapshot; HTTP must not inherit that capability.
  await students.updateStudentTurmas(admin, student, turmaIds, turmaIds[0]);
  const before = await snapshot();
  const response = await updateViaHttp({ turmaIds: [], primaryTurmaId: null, skipExpected: true });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /estado inicial/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await snapshot(), before);
});

test("HTTP rejects malformed snapshots with 400 without changing data", async () => {
  const before = await snapshot();
  for (const expected of [null, false, [], "skip", {}, { turmaIds: [], primaryTurmaId: "other" }, { turmaIds: [1], primaryTurmaId: null }]) {
    const response = await updateViaHttp({ turmaIds: [], primaryTurmaId: null, expected });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.deepEqual(await snapshot(), before);
});

test("HTTP returns 409 for a stale snapshot and 200 for the current snapshot", async () => {
  await students.updateStudentTurmas(admin, student, [turmaIds[0]], null);
  const expected = { turmaIds: [turmaIds[0]], primaryTurmaId: null };
  await groups.setMembership(owner, turmaIds[1], student, true);
  const before = await snapshot();
  const stale = await updateViaHttp({ turmaIds: [], primaryTurmaId: null, expected });
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /mudou/);
  assert.deepEqual(await snapshot(), before);
  const next = { turmaIds: [turmaIds[1]], primaryTurmaId: turmaIds[1] };
  const current = await updateViaHttp({ ...next, expected: { turmaIds: [...turmaIds].reverse(), primaryTurmaId: null } });
  assert.equal(current.status, 200);
  assert.equal(current.headers.get("cache-control"), "no-store");
  assert.deepEqual(await current.json(), next);
  assert.deepEqual(await memberships(), next.turmaIds);
  assert.equal((await pool.query("SELECT primary_turma_id FROM gallery_users WHERE id=$1", [student])).rows[0].primary_turma_id, next.primaryTurmaId);
});
