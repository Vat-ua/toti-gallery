import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";
let pool: typeof import("../src/db").pool;
let operations: typeof import("../src/lib/project-likes");
let allowAttempt: typeof import("../src/lib/auth-rate-limit").allowAttempt;
let baseline: Record<string, string>;
const project = randomUUID(), owner = randomUUID(), group = randomUUID(), visitor = randomUUID(), other = randomUUID(), quotaVisitor = randomUUID();
async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows) result[tablename] = createHash("sha256").update(JSON.stringify((await pool.query(`SELECT * FROM "${tablename}"`)).rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  return result;
}
before(async () => {
  const loaded = config({ path: process.env.GALLERY_LIKES_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  if (loaded.error) throw new Error("Select an isolated test database.");
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  ({ pool } = await import("../src/db")); await assertDatabaseTarget(pool, process.env, "test"); baseline = await snapshot();
  operations = await import("../src/lib/project-likes"); ({ allowAttempt } = await import("../src/lib/auth-rate-limit"));
  const number = randomInt(1000000, 800000000);
  await pool.query("INSERT INTO gallery_turmas(id,name,number) VALUES($1,$2,$3)", [group, `Turma ${number}`, number]);
  await pool.query("INSERT INTO gallery_users(id,name,email) VALUES($1,'Like fixture',$2)", [owner, `${owner}@example.invalid`]);
  await pool.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,base_likes) VALUES($1,$1,'Like fixture','A fixture description','[\"React\"]','https://github.com',$2,$3,3)", [project, owner, group]);
});
after(async () => {
  if (!pool) return;
  try { if (baseline) {
    await pool.query("DELETE FROM gallery_projects WHERE id=$1", [project]);
    await pool.query("DELETE FROM gallery_users WHERE id=$1", [owner]); await pool.query("DELETE FROM gallery_turmas WHERE id=$1", [group]);
    const key = `project-like:${createHash("sha256").update(quotaVisitor).digest("hex")}`;
    await pool.query("DELETE FROM gallery_auth_rate_limits WHERE key=$1", [key]);
    assert.deepEqual(await snapshot(), baseline, "Original isolated rows changed");
  } } finally { await pool.end(); }
});
function businessState(value: { liked: boolean; likes: number; observedAt?: number }) {
  assert(Number.isSafeInteger(value.observedAt) && value.observedAt! > 0);
  return { liked: value.liked, likes: value.likes };
}
test("repeated desired states are idempotent and preserve the demo base count", async () => {
  for (let i = 0; i < 3; i++) assert.deepEqual(businessState(await operations.setProjectLike(project, visitor, true)), { liked: true, likes: 4 });
  assert.deepEqual(businessState(await operations.readProjectLike(project, visitor)), { liked: true, likes: 4 });
  for (let i = 0; i < 3; i++) assert.deepEqual(businessState(await operations.setProjectLike(project, visitor, false)), { liked: false, likes: 3 });
});
test("concurrent duplicates create one like; different browsers remain independent", async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => operations.setProjectLike(project, visitor, true)));
  assert.ok(results.every(result => result.liked && result.likes === 4));
  assert.deepEqual(businessState(await operations.setProjectLike(project, other, true)), { liked: true, likes: 5 });
  await operations.setProjectLike(project, visitor, false); assert.deepEqual(businessState(await operations.readProjectLike(project, other)), { liked: true, likes: 4 });
});
test("opposite parallel actions serialize and the final explicit action determines the stored state", async () => {
  await Promise.all([true, false, true, false].map(liked => operations.setProjectLike(project, visitor, liked)));
  assert.deepEqual(businessState(await operations.setProjectLike(project, visitor, false)), { liked: false, likes: 4 });
  assert.deepEqual(businessState(await operations.readProjectLike(project, visitor)), { liked: false, likes: 4 });
});
test("reconciliation waits for an in-progress write before reading the committed snapshot", async () => {
  const client = await pool.connect();
  let reading: Promise<Awaited<ReturnType<typeof operations.readProjectLike>>> | undefined;
  try {
    await client.query("BEGIN"); await client.query("SELECT id FROM gallery_projects WHERE id=$1 FOR UPDATE", [project]);
    await client.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES($1,$2) ON CONFLICT DO NOTHING", [project, visitor]);
    let resolved = false; reading = operations.readProjectLike(project, visitor).then(result => { resolved = true; return result; });
    await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(resolved, false);
    await client.query("COMMIT"); assert.deepEqual(businessState(await reading), { liked: true, likes: 5 });
  } finally { await client.query("ROLLBACK"); client.release(); await reading; }
});
test("missing and hidden projects reject writes without changing their likes", async () => {
  await assert.rejects(operations.setProjectLike(randomUUID(), visitor, true), error => (error as { status: number }).status === 404);
  await pool.query("UPDATE gallery_projects SET visibility='hidden',moderation_reason='Fixture',moderated_by=$1,moderated_at=now() WHERE id=$2", [owner, project]);
  try {
    await assert.rejects(operations.setProjectLike(project, visitor, false), error => (error as { status: number }).status === 404);
    await assert.rejects(operations.readProjectLike(project, visitor), error => (error as { status: number }).status === 404);
  } finally { await pool.query("UPDATE gallery_projects SET visibility='published' WHERE id=$1", [project]); }
  assert.deepEqual(businessState(await operations.readProjectLike(project, visitor)), { liked: true, likes: 5 });
});
test("the existing durable limiter allows exactly 60 parallel actions per browser per minute", async () => {
  const allowed = await Promise.all(Array.from({ length: 64 }, () => allowAttempt("project-like", quotaVisitor, 60, 60)));
  assert.equal(allowed.filter(Boolean).length, 60);
  assert.equal(await allowAttempt("project-like", quotaVisitor, 60, 60), false);
  const key = `project-like:${createHash("sha256").update(quotaVisitor).digest("hex")}`;
  await pool.query("UPDATE gallery_auth_rate_limits SET last_request=$1 WHERE key=$2", [Date.now() - 61_000, key]);
  assert.equal(await allowAttempt("project-like", quotaVisitor, 60, 60), true);
});
