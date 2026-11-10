import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget, assertRuntimeTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let students: typeof import("../src/lib/admin-students");
let groups: typeof import("../src/lib/admin-turmas");
let queries: typeof import("../src/lib/queries");
const ids = new Set<string>(), groupIds: string[] = [], projectIds: string[] = [];
const prefix = `profile-fixture-${randomUUID()}`;
let actor: string, person: string;
let baseline: Record<string, string>;

async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows) {
    const rows = (await pool.query(`SELECT * FROM "${tablename}"`)).rows;
    result[tablename] = createHash("sha256").update(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return result;
}
async function fixture(role = "user") {
  const id = randomUUID(); ids.add(id);
  await pool.query("INSERT INTO gallery_users(id,name,email,role,status,email_verified) VALUES ($1,'Profile Fixture',$2,$3,'active',true)", [id, `${prefix}-${id}@example.invalid`, role]);
  return id;
}
before(async () => {
  const envFile = process.env.GALLERY_PROFILE_TEST_ENV_FILE || ".env.admin-test";
  config({ path: envFile, override: true, quiet: true });
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  ({ pool } = await import("../src/db")); await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot();
  students = await import("../src/lib/admin-students"); groups = await import("../src/lib/admin-turmas"); queries = await import("../src/lib/queries");
  actor = await fixture("admin"); person = await fixture();
  const number = randomInt(1000000, 800000000);
  for (let i = 0; i < 2; i++) groupIds.push((await groups.saveTurma(actor, { number: number + i, courseName: i ? "Full Stack" : "Front End", startYear: 2025 + i })).id);
});
after(async () => {
  if (!pool) return;
  try {
    await pool.query("DELETE FROM gallery_invitations WHERE user_id=ANY($1::text[]) OR created_by=ANY($1::text[])", [[...ids]]);
    await pool.query("DELETE FROM gallery_projects WHERE id=ANY($1::text[])", [projectIds]);
    await pool.query("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[]) OR turma_id=ANY($2::text[])", [[...ids], groupIds]);
    await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [[...ids]]);
    await pool.query("DELETE FROM gallery_turmas WHERE id=ANY($1::text[])", [groupIds]);
    if (baseline) assert.deepEqual(await snapshot(), baseline, "Original isolated rows changed");
  } finally { await pool.end(); }
});

test("name-based slugs remain unique for concurrent provisioning and stable after renaming", async () => {
  const name = `João ${randomUUID()}`;
  const created = await Promise.all([1, 2].map(i => groups.addStudent(actor, groupIds[0], name, `${prefix}-same-${i}@example.invalid`)));
  created.forEach(p => ids.add(p.id));
  const rows = (await pool.query("SELECT id,slug FROM gallery_users WHERE id=ANY($1::text[]) ORDER BY slug", [created.map(p => p.id)])).rows;
  assert.notEqual(rows[0].slug, rows[1].slug);
  assert.match(rows[0].slug, /^joao-/);
  assert.equal(rows[1].slug, `${rows[0].slug}-2`);
  const target = created[0], original = rows.find(row => row.id === target.id).slug;
  await students.updateStudentProfile(actor, target.id, "A completely different name", `${prefix}-same-1@example.invalid`, { name: target.name, email: target.email });
  assert.equal((await pool.query("SELECT slug FROM gallery_users WHERE id=$1", [target.id])).rows[0].slug, original);
});

test("automatic primary turma uses the highest number; explicit selection controls public metadata", async () => {
  await students.updateStudentTurmas(actor, person, groupIds);
  // Archive and enrollment order do not change the default presentation rule.
  await pool.query("UPDATE gallery_turmas SET archived_at=now(),graduation_year=2030 WHERE id=$1", [groupIds[1]]);
  const automatic = await queries.getPerson(person);
  assert.equal(automatic?.turmaId, groupIds[1]);
  assert.equal(automatic?.courseName, "Full Stack"); assert.equal(automatic?.year, 2026);
  assert.equal(automatic?.cohorts.length, 2);
  await students.updateStudentTurmas(actor, person, groupIds, groupIds[0]);
  const explicit = await queries.getPerson(person);
  assert.equal(explicit?.turmaId, groupIds[0]); assert.equal(explicit?.courseName, "Front End"); assert.equal(explicit?.year, 2025);
  assert.equal((await queries.getCommunityPeople()).filter(p => p.id === person).length, 1);
  assert((await queries.getCommunityPeople()).find(p => p.id === person)?.cohorts.includes(automatic!.cohort));
  assert.equal((await queries.getPersonBySlug(explicit!.slug))?.id, person);
  assert.equal(await queries.getPersonBySlug(person), null, "Old ID addresses must not resolve");
});

test("primary-turma writes enforce staff permissions and actual membership", async () => {
  await assert.rejects(() => students.updateStudentTurmas(person, actor, groupIds, groupIds[0]), /restrito/);
  await assert.rejects(() => students.updateStudentTurmas(actor, person, [groupIds[0]], groupIds[1]), /principal/);
  await assert.rejects(() => students.updateStudentTurmas(actor, person, groupIds, "unknown"), /principal/);
  await assert.rejects(() => students.updateStudentTurmas(actor, person, groupIds, {}), /principal/);
  assert.equal((await queries.getPerson(person))?.turmaId, groupIds[0]);
});

test("single-profile lookups match the public list, including eligibility and missing memberships", async () => {
  const pending = await fixture(), demo = await fixture(), noTurma = await fixture();
  await pool.query("UPDATE gallery_users SET email_verified=false WHERE id=ANY($1::text[])", [[pending, demo]]);
  await pool.query("UPDATE gallery_users SET is_demo=true WHERE id=$1", [demo]);
  const people = await queries.getPeople();
  for (const id of [person, pending, demo, noTurma]) {
    const slug = (await pool.query("SELECT slug FROM gallery_users WHERE id=$1", [id])).rows[0].slug;
    const expected = people.find(p => p.id === id) || null;
    assert.deepEqual(await queries.getPerson(id), expected);
    assert.deepEqual(await queries.getPersonBySlug(slug), expected);
  }
  assert.equal(await queries.getPerson(pending), null);
  assert.equal((await queries.getPerson(demo))?.id, demo);
  assert.deepEqual((await queries.getPerson(noTurma))?.cohorts, []);
  assert.equal((await queries.getPerson(noTurma))?.cohort, "Sem turma");
  assert.equal(await queries.getPerson(randomUUID()), null);
  assert.equal(await queries.getPersonBySlug("missing-profile-fixture"), null);
});

test("profile lookup uses one scoped query and works with a transaction", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const statements: string[] = [];
  const connection = drizzle(pool, { logger: { logQuery(query) { statements.push(query); } } });
  const result = await queries.getPerson(person, connection);
  assert.equal(result?.id, person);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /where.*"gallery_users"\."id" = \$1/i);
  statements.length = 0;
  assert.deepEqual(await queries.getPersonBySlug(result!.slug, connection), result);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /where.*"gallery_users"\."slug" = \$1/i);
  await connection.transaction(async tx => {
    assert.deepEqual(await queries.getPerson(person, tx), result);
  });
});

test("optional LinkedIn persists on the same public profile and can be removed", async () => {
  const { validateProfile } = await import("../src/lib/account");
  const original = (await pool.query("SELECT * FROM gallery_users WHERE id=$1", [person])).rows[0];
  const validated = validateProfile({ name: original.name, bio: original.bio, avatar: original.avatar, github: original.github, linkedin: " https://www.linkedin.com/in/profile-fixture " }, original.avatar);
  await pool.query("UPDATE gallery_users SET linkedin=$1 WHERE id=$2", [validated.linkedin, person]);
  const publicPerson = await queries.getPersonBySlug(original.slug);
  assert.equal(publicPerson?.id, person); assert.equal(publicPerson?.linkedin, validated.linkedin);
  const { linkedin: stored, ...rest } = (await pool.query("SELECT * FROM gallery_users WHERE id=$1", [person])).rows[0];
  const { linkedin: previous, ...before } = original;
  assert.equal(stored, validated.linkedin); assert.equal(previous, null); assert.deepEqual(rest, before);
  const cleared = validateProfile({ ...validated, linkedin: "" }, original.avatar);
  await pool.query("UPDATE gallery_users SET linkedin=$1 WHERE id=$2", [cleared.linkedin, person]);
  assert.equal((await queries.getPerson(person))?.linkedin, null);
});

test("removing the primary membership restores automatic display and preserves credits and likes", async () => {
  const id = randomUUID(); projectIds.push(id);
  await pool.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id) VALUES ($1,$2,'Fixture','Description','[]','https://github.com',$3,$4)", [id, prefix, person, groupIds[0]]);
  await pool.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES ($1,$2),($1,$3)", [id, person, actor]);
  await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES ($1,'fixture-like')", [id]);
  const original = (await pool.query("SELECT * FROM gallery_projects WHERE id=$1", [id])).rows[0];
  await groups.setMembership(actor, groupIds[0], person, false);
  assert.equal((await pool.query("SELECT primary_turma_id FROM gallery_users WHERE id=$1", [person])).rows[0].primary_turma_id, null);
  assert.equal((await queries.getPerson(person))?.turmaId, groupIds[1]);
  await students.updateStudentTurmas(actor, person, groupIds, groupIds[1]);
  await students.updateStudentTurmas(actor, person, [groupIds[0]]);
  assert.equal((await pool.query("SELECT primary_turma_id FROM gallery_users WHERE id=$1", [person])).rows[0].primary_turma_id, null);
  assert.equal((await queries.getPerson(person))?.turmaId, groupIds[0]);
  await students.updateStudentTurmas(actor, person, []);
  assert.equal((await queries.getPerson(person))?.turmaId, null);
  assert.deepEqual((await pool.query("SELECT * FROM gallery_projects WHERE id=$1", [id])).rows[0], original);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_project_authors WHERE project_id=$1", [id])).rows[0].n, 2);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM gallery_likes WHERE project_id=$1", [id])).rows[0].n, 1);
});
