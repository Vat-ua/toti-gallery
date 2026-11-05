import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomInt, createHash } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";
import { projectRouteHarness } from "./helpers/project-route-harness";
import type { ImageMetadata } from "../src/lib/image-policy";

let pool: typeof import("../src/db").pool;
let harness: ReturnType<typeof projectRouteHarness>;
let baseline: Record<string, string>;
const owner = randomUUID(), coauthor = randomUUID(), outsider = randomUUID(), noTurma = randomUUID();
const userIds = [owner, coauthor, outsider, noTurma], group = randomUUID(), otherGroup = randomUUID();
const prefix = `Refactor fixture ${randomUUID()}`;
const origin = "http://localhost:3000";
const framing = { x: 30, y: 65, zoom: 1.4 };
const input = (patch: Record<string, unknown> = {}) => ({ title: prefix, description: "Uma descrição de projeto com conteúdo suficiente para validação.", technologies: ["React", "CSS"], coverStyle: "books", githubUrl: "https://github.com/example/project", liveUrl: "", isFinal: true, turmaId: group, coauthorIds: [coauthor], imageUrl: "", coverFraming: null, ...patch });
function request(method: string, body?: Record<string, unknown>, file = false, requestOrigin = origin) {
  const headers: Record<string, string> = { origin: requestOrigin };
  let data: string | FormData | undefined;
  if (file) { data = new FormData(); data.set("data", JSON.stringify(body)); data.set("image", new File(["fixture"], "cover.png", { type: "image/png" })); }
  else if (body) { headers["content-type"] = "application/json"; data = JSON.stringify(body); }
  return new Request(`${origin}/api/projects`, { method, headers, body: data });
}
const context = (id: string) => ({ params: Promise.resolve({ id }) });
async function row(id: string) { return (await pool.query("SELECT * FROM gallery_projects WHERE id=$1", [id])).rows[0]; }
async function credits(id: string) { return (await pool.query("SELECT user_id FROM gallery_project_authors WHERE project_id=$1 ORDER BY user_id", [id])).rows.map(r => r.user_id); }
async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%' ORDER BY tablename")).rows) {
    result[tablename] = createHash("sha256").update(JSON.stringify((await pool.query(`SELECT * FROM "${tablename}"`)).rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return result;
}
async function create(patch: Record<string, unknown> = {}, file = false) {
  const response = await harness.collection.POST(request("POST", input(patch), file));
  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  const result = await response.json(); assert.deepEqual(Object.keys(result).sort(), ["id", "slug"]);
  return result as { id: string; slug: string };
}
async function attachImage(id: string): Promise<ImageMetadata> {
  const metadata: ImageMetadata = { key: `covers/${randomUUID()}/image.webp`, width: 900, height: 600, bytes: 100, format: "webp" };
  await pool.query("UPDATE gallery_projects SET image_url=$1,image_metadata=$2,cover_framing=$3 WHERE id=$4", [`/media/${metadata.key}`, metadata, framing, id]);
  return metadata;
}
before(async () => {
  const loaded = config({ path: process.env.GALLERY_PROJECT_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  if (loaded.error) throw new Error("Select an existing isolated test database; see docs/environments.md.");
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  ({ pool } = await import("../src/db")); await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot();
  harness = projectRouteHarness();
  const number = randomInt(1000000, 800000000);
  for (const [index, id] of [group, otherGroup].entries()) await pool.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year,archived_at) VALUES($1,$2,$3,'Fixture',2026,now())", [id, `Turma ${number + index}`, number + index]);
  for (const id of userIds) await pool.query("INSERT INTO gallery_users(id,name,email,status,email_verified) VALUES($1,'Project fixture',$2,'active',true)", [id, `${id}@example.invalid`]);
  for (const [id, turma] of [[owner, group], [coauthor, group], [outsider, otherGroup]]) await pool.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [id, turma]);
});
beforeEach(() => { harness.reset(); harness.state.actorId = owner; });
after(async () => {
  if (!pool) return;
  try {
    if (baseline) {
      await pool.query("DELETE FROM gallery_projects WHERE author_id=ANY($1::text[])", [userIds]);
      await pool.query("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[])", [userIds]);
      await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [userIds]);
      await pool.query("DELETE FROM gallery_turmas WHERE id=ANY($1::text[])", [[group, otherGroup]]);
      assert.deepEqual(await snapshot(), baseline, "Original isolated rows changed");
    }
  } finally { harness?.restore(); await pool.end(); }
});

test("all student mutations reject missing sessions and foreign origins before writes", async () => {
  const id = randomUUID();
  const operations = [() => harness.collection.POST(request("POST", input())), () => harness.item.PATCH(request("PATCH", input()), context(id)), () => harness.item.DELETE(request("DELETE"), context(id)), () => harness.authors.DELETE(request("DELETE"), context(id))];
  harness.state.actorId = null;
  for (const op of operations) assert.equal((await op()).status, 401);
  harness.state.actorId = owner;
  assert.equal((await harness.collection.POST(request("POST", input(), false, "https://foreign.invalid"))).status, 403);
  assert.equal((await harness.item.PATCH(request("PATCH", input(), false, "https://foreign.invalid"), context(id))).status, 403);
  assert.equal((await harness.item.DELETE(request("DELETE", undefined, false, "https://foreign.invalid"), context(id))).status, 403);
  assert.equal((await harness.authors.DELETE(request("DELETE", undefined, false, "https://foreign.invalid"), context(id))).status, 403);
});
test("create accepts archived memberships, records one publication and server-owned authorship", async () => {
  const result = await create({ authorId: outsider, visibility: "hidden", baseLikes: 1000 });
  const stored = await row(result.id);
  assert.equal(stored.author_id, owner); assert.equal(stored.turma_id, group); assert.equal(stored.is_final, true);
  assert.equal(stored.visibility, "published"); assert.equal(stored.base_likes, 0); assert.equal(stored.slug, result.slug);
  assert.deepEqual(await credits(result.id), [owner, coauthor].sort());
});
test("invalid fields, turma and coauthors reject creation atomically; failed upload is cleaned", async () => {
  const count = async () => Number((await pool.query("SELECT count(*) FROM gallery_projects WHERE author_id=$1", [owner])).rows[0].count);
  const before = await count();
  for (const patch of [{ title: "x" }, { turmaId: otherGroup }, { coauthorIds: [outsider] }]) {
    const response = await harness.collection.POST(request("POST", input(patch)));
    assert.equal(response.status, 400); assert.ok((await response.json()).fieldErrors);
  }
  harness.state.actorId = noTurma;
  assert.equal((await harness.collection.POST(request("POST", input()))).status, 400);
  harness.state.actorId = owner;
  const failed = await harness.collection.POST(request("POST", input({ coauthorIds: [outsider] }), true));
  assert.equal(failed.status, 400); assert.equal(harness.state.uploaded.length, 1);
  assert.deepEqual(harness.state.deleted, harness.state.uploaded); assert.equal(harness.state.deferred.length, 0);
  assert.equal(await count(), before);
});
test("only the owner edits/deletes; only a coauthor can leave without losing publication or likes", async () => {
  const { id } = await create();
  await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES($1,'fixture-like')", [id]);
  const original = await row(id);
  for (const actor of [coauthor, outsider]) {
    harness.state.actorId = actor;
    assert.equal((await harness.item.PATCH(request("PATCH", input()), context(id))).status, 404);
    assert.equal((await harness.item.DELETE(request("DELETE"), context(id))).status, 404);
  }
  assert.equal((await harness.authors.DELETE(request("DELETE"), context(id))).status, 404);
  harness.state.actorId = owner; assert.equal((await harness.authors.DELETE(request("DELETE"), context(id))).status, 403);
  harness.state.actorId = coauthor;
  const response = await harness.authors.DELETE(request("DELETE"), context(id));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(await row(id), original); assert.deepEqual(await credits(id), [owner]);
  assert.equal((await pool.query("SELECT * FROM gallery_likes WHERE project_id=$1", [id])).rowCount, 1);
  assert.equal((await harness.authors.DELETE(request("DELETE"), context(id))).status, 404);
});
test("editing preserves moderation, turma, likes, image/framing and omitted coauthors", async () => {
  const { id, slug } = await create(); const image = await attachImage(id);
  await pool.query("UPDATE gallery_projects SET visibility='hidden',moderation_reason='Fixture reason',moderated_by=$1,moderated_at=now() WHERE id=$2", [owner, id]);
  await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES($1,'fixture-like')", [id]);
  const previous = await row(id), value = input({ title: `${prefix} updated`, imageUrl: `/media/${image.key}` });
  delete (value as Record<string, unknown>).coauthorIds; delete (value as Record<string, unknown>).coverFraming;
  const response = await harness.item.PATCH(request("PATCH", value), context(id));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, slug });
  const stored = await row(id);
  for (const key of ["author_id", "turma_id", "created_at", "visibility", "moderation_reason", "moderated_by", "moderated_at", "image_url", "image_metadata", "cover_framing"]) assert.deepEqual(stored[key], previous[key], key);
  assert.deepEqual(await credits(id), [owner, coauthor].sort()); assert.equal(harness.state.deferred.length, 0);
  const wrongTurma = await harness.item.PATCH(request("PATCH", input({ turmaId: otherGroup })), context(id));
  assert.equal(wrongTurma.status, 400); assert.ok((await wrongTurma.json()).fieldErrors.turmaId);
  assert.equal((await pool.query("SELECT * FROM gallery_likes WHERE project_id=$1", [id])).rowCount, 1);
});
test("cover replacement retires old image only after commit; removal resets framing", async () => {
  const { id } = await create(); const old = await attachImage(id);
  const response = await harness.item.PATCH(request("PATCH", input({ coverFraming: framing }), true), context(id));
  assert.equal(response.status, 200);
  assert.equal((await row(id)).image_url, `/media/${harness.state.uploaded[0].key}`);
  assert.deepEqual((await row(id)).cover_framing, framing); assert.deepEqual(harness.state.retired, []);
  await harness.flush(); assert.deepEqual(harness.state.retired, [old]); assert.deepEqual(harness.state.deleted, []);
  const next = (await row(id)).image_metadata;
  assert.equal((await harness.item.PATCH(request("PATCH", input({ coauthorIds: [] })), context(id))).status, 200);
  const removed = await row(id); assert.equal(removed.image_url, null); assert.equal(removed.image_metadata, null); assert.equal(removed.cover_framing, null);
  assert.deepEqual(await credits(id), [owner]); await harness.flush(); assert.deepEqual(harness.state.retired, [old, next]);
});
test("upload failure and invalid coauthors roll back updates and never retire the original image", async () => {
  const { id } = await create(); const old = await attachImage(id); const original = await row(id);
  harness.state.uploadError = new Error("Fixture upload failed");
  assert.equal((await harness.item.PATCH(request("PATCH", input(), true), context(id))).status, 500);
  assert.deepEqual(await row(id), original);
  harness.state.uploadError = null;
  const response = await harness.item.PATCH(request("PATCH", input({ coauthorIds: [outsider] }), true), context(id));
  assert.equal(response.status, 400); assert.deepEqual(await row(id), original); assert.deepEqual(await credits(id), [owner, coauthor].sort());
  assert.deepEqual(harness.state.deleted, harness.state.uploaded); assert.deepEqual(harness.state.retired, []); assert.equal(harness.state.deferred.length, 0);
  assert.notEqual(harness.state.deleted[0].key, old.key);
});
test("upload throttling rejects before storage; deleting cascades credits/likes and schedules retirement", async () => {
  const { id, slug } = await create(); const old = await attachImage(id);
  harness.state.allowUpload = false;
  assert.equal((await harness.item.PATCH(request("PATCH", input(), true), context(id))).status, 429); assert.equal(harness.state.uploaded.length, 0);
  await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES($1,'fixture-like')", [id]);
  const response = await harness.item.DELETE(request("DELETE"), context(id));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, slug });
  assert.equal(await row(id), undefined); assert.deepEqual(await credits(id), []);
  assert.equal((await pool.query("SELECT * FROM gallery_likes WHERE project_id=$1", [id])).rowCount, 0);
  assert.deepEqual(harness.state.retired, []); await harness.flush(); assert.deepEqual(harness.state.retired, [old]);
  assert.equal((await harness.item.DELETE(request("DELETE"), context(id))).status, 404);
});

test("multipart creation saves cover metadata/framing and keeps the successful upload", async () => {
  const { id } = await create({ coverFraming: framing }, true);
  const stored = await row(id);
  assert.equal(stored.image_url, `/media/${harness.state.uploaded[0].key}`);
  assert.deepEqual(stored.image_metadata, harness.state.uploaded[0]); assert.deepEqual(stored.cover_framing, framing);
  assert.deepEqual(harness.state.deleted, []); assert.equal(harness.state.deferred.length, 0);
});

test("a concurrent cover replacement cannot be overwritten by an earlier image reference", async () => {
  const { id } = await create(); const old = await attachImage(id);
  const replacement: ImageMetadata = { ...old, key: `covers/${randomUUID()}/image.webp` };
  const writer = await pool.connect();
  let pending: Promise<Response> | undefined;
  try {
    await writer.query("BEGIN");
    const pid = (await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    await writer.query("UPDATE gallery_projects SET image_url=$1,image_metadata=$2 WHERE id=$3", [`/media/${replacement.key}`, replacement, id]);
    pending = harness.item.PATCH(request("PATCH", input({ imageUrl: `/media/${old.key}` })), context(id));
    const deadline = Date.now() + 15000;
    let blocked = false;
    while (Date.now() < deadline) {
      blocked = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND datname=current_database()", [pid])).rowCount! > 0;
      if (blocked) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(blocked, "The update must reach the transaction's row lock");
    await writer.query("COMMIT");
    const response = await pending;
    assert.equal(response.status, 400); assert.match((await response.json()).error, /capa mudou/);
    assert.equal((await row(id)).image_url, `/media/${replacement.key}`);
    assert.deepEqual(harness.state.deleted, []); assert.equal(harness.state.deferred.length, 0);
  } finally { await writer.query("ROLLBACK"); writer.release(); if (pending) await pending; }
});

test("a real project commit whose acknowledgement is lost keeps its new image and author credits", async () => {
  const { db } = await import("../src/db");
  const originalTransaction = db.transaction;
  db.transaction = (async (...args: Parameters<typeof db.transaction>) => {
    await originalTransaction.apply(db, args);
    throw Object.assign(new Error("Fixture lost COMMIT acknowledgement"), { code: "ECONNRESET" });
  }) as typeof db.transaction;
  try {
    const response = await harness.collection.POST(request("POST", input(), true));
    assert.equal(response.status, 503);
    const saved = (await pool.query("SELECT id FROM gallery_projects WHERE author_id=$1 AND image_url=$2", [owner, `/media/${harness.state.uploaded[0].key}`])).rows;
    assert.equal(saved.length, 1); assert.deepEqual(await credits(saved[0].id), [owner, coauthor].sort());
    assert.deepEqual(harness.state.deleted, []); assert.deepEqual(harness.state.retired, []);
  } finally { db.transaction = originalTransaction; }
});
