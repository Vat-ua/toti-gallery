import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomInt, createHash } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";
import { COLLECTION_PAGE_SIZE as SIZE } from "../src/lib/collection-page";
import { adminProjectHref, adminProjectReturn, parseAdminProjectFilters } from "../src/lib/admin-project-params";

let pool: typeof import("../src/db").pool;
let service: typeof import("../src/lib/admin-projects");
const prefix = `moderation-${randomUUID()}`;
const admin = randomUUID(), student = randomUUID(), coauthor = randomUUID(), suspended = randomUUID();
const group = randomUUID(), otherGroup = randomUUID(), ids = Array.from({ length: SIZE * 4 + 2 }, () => randomUUID());
let baseline: Record<string, string>;
async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%'")).rows) {
    result[tablename] = createHash("sha256").update(JSON.stringify((await pool.query(`SELECT * FROM "${tablename}"`)).rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return result;
}
before(async () => {
  config({ path: process.env.GALLERY_ADMIN_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  ({ pool } = await import("../src/db"));
  await assertDatabaseTarget(pool, process.env, "test");
  baseline = await snapshot();
  service = await import("../src/lib/admin-projects");
  for (const [id, name, role, status] of [[admin, "Moderator", "admin", "active"], [student, "Publication owner", "user", "active"], [coauthor, `João ${prefix}`, "user", "active"], [suspended, "Suspended moderator", "admin", "suspended"]]) {
    await pool.query("INSERT INTO gallery_users(id,name,email,role,status,email_verified) VALUES($1,$2,$3,$4,$5,true)", [id, name, `${id}@example.invalid`, role, status]);
  }
  const number = randomInt(1000000, 900000000);
  for (const [index, id] of [group, otherGroup].entries()) await pool.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year,archived_at) VALUES($1,$2,$3,'Fixture',2026,now())", [id, `Turma ${number + index}`, number + index]);
  for (const [index, id] of ids.entries()) {
    await pool.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,base_likes,is_final,created_at) VALUES($1,$2,$3,'Keep this content','[\"React\"]','https://github.com',$4,$5,7,true,$6)", [id, `${prefix}-${index}`, `${prefix} ${index}`, student, index === ids.length - 1 ? otherGroup : group, new Date(2026, 0, 1, 0, 0, index)]);
    await pool.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2),($1,$3)", [id, student, coauthor]);
    await pool.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES($1,'fixture-like')", [id]);
  }
});
after(async () => {
  if (!pool) return;
  try {
    await pool.query("DELETE FROM gallery_projects WHERE id=ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM gallery_turmas WHERE id=ANY($1::text[])", [[group, otherGroup]]);
    await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [[admin, student, coauthor, suspended]]);
    if (baseline) assert.deepEqual(await snapshot(), baseline, "Original test data changed");
  } finally { await pool.end(); }
});

test("project filters and return links reject invalid input and retain scope", () => {
  const filters = parseAdminProjectFilters({ q: "  React  ", turma: group, visibility: "hidden", page: "2" });
  assert.equal(filters.query, "React"); assert.equal(filters.page, 2);
  assert.equal(parseAdminProjectFilters({ page: "1e9", visibility: "anything", q: ["a"] }).page, 1);
  assert.match(adminProjectHref(filters, group), /tab=projetos/);
  assert.equal(adminProjectReturn(adminProjectHref(filters, group)), adminProjectHref(filters, group));
  for (const value of ["https://evil.invalid", "//evil.invalid", "http://[", "/admin/estudantes", "/\\evil.invalid", "/admin/projetos\n"]) assert.equal(adminProjectReturn(value), "/admin/projetos");
});
test("all reads and writes require active staff", async () => {
  for (const actor of [student, suspended, randomUUID()]) {
    await assert.rejects(() => service.listAdminProjects(actor), /restrito/);
    await assert.rejects(() => service.getAdminProject(actor, ids[0]), /restrito/);
    await assert.rejects(() => service.readAdminProjectPage(actor), /restrito/);
    await assert.rejects(() => service.moderateProject(actor, ids[0], "hide", "published", "Reason"), /restrito/);
  }
});
test("incremental loading searches all coauthors, retains earlier cards and filters archived turmas", async () => {
  const filters = { query: `joao ${prefix}`, turmaId: group };
  const first = await service.listAdminProjects(admin, filters);
  assert.equal(first.total, ids.length - 1); assert.equal(first.items.length, SIZE);
  const second = await service.listAdminProjects(admin, { ...filters, page: 2 });
  assert.equal(second.items.length, SIZE * 2);
  assert.deepEqual(second.items.slice(0, SIZE).map(project => project.id), first.items.map(project => project.id));
  assert.equal(new Set(second.items.map(project => project.id)).size, SIZE * 2);
  const beyondInitial = await service.listAdminProjects(admin, { query: `${prefix} 0`, turmaId: group });
  assert.equal(beyondInitial.total, 1); assert.equal(beyondInitial.items[0].id, ids[0]);
  const deep = await service.listAdminProjects(admin, { ...filters, page: 100 });
  assert.equal(deep.filters.page, 5); assert.equal(deep.loadedPages, 3); assert.equal(deep.items.length, SIZE * 3);
  const batch = await service.readAdminProjectPage(admin, { ...filters, page: 2 });
  assert.equal(batch.items.length, SIZE); assert.equal(batch.previousId, first.items.at(-1)!.id);
  assert.deepEqual(batch.items.map(project => project.id), second.items.slice(SIZE).map(project => project.id));
  const last = await service.readAdminProjectPage(admin, { ...filters, page: 100 });
  assert.equal(last.page, 5); assert.equal(last.items.length, 1); assert.equal(last.hasMore, false);
  for (const project of batch.items) for (const field of ["description", "version", "githubUrl", "liveUrl", "moderatedAt", "moderatedByName"]) assert(!(field in project), field);
  assert.equal((await service.listAdminProjects(admin, { query: prefix + "-nothing" })).total, 0);
  assert.equal(first.items[0].authors.length, 2); assert.equal(first.items[0].likes, 8);
});
test("moderation preserves content, authors and likes, and rejects invalid or stale actions", async () => {
  const id = ids[0];
  const original = (await pool.query("SELECT * FROM gallery_projects WHERE id=$1", [id])).rows[0];
  await assert.rejects(() => service.moderateProject(admin, id, "hide", "published", "  "), /motivo/);
  await assert.rejects(() => service.moderateProject(admin, id, "hide", "published", "x".repeat(1001)), /motivo/);
  await assert.rejects(() => service.moderateProject(admin, id, "delete", "published", "Reason"), /inválida/);
  await assert.rejects(() => service.moderateProject(admin, randomUUID(), "hide", "published", "Reason"), error => (error as { status: number }).status === 404);
  const outcomes = await Promise.allSettled([service.moderateProject(admin, id, "hide", "published", "First reason"), service.moderateProject(admin, id, "hide", "published", "Second reason")]);
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  const conflict = outcomes.find(result => result.status === "rejected") as PromiseRejectedResult;
  assert.equal(conflict.reason.status, 409);
  const hidden = await service.getAdminProject(admin, id);
  assert.equal(hidden?.visibility, "hidden"); assert.equal(hidden?.moderatedByName, "Moderator");
  assert.ok(hidden?.moderationReason); assert.ok(hidden?.moderatedAt);
  const list = await service.listAdminProjects(admin, { query: prefix, visibility: "hidden" });
  assert.equal(list.total, 1); assert.equal(list.items[0].id, id);
  const row = (await pool.query("SELECT * FROM gallery_projects WHERE id=$1", [id])).rows[0];
  for (const key of Object.keys(original).filter(key => !["visibility", "moderation_reason", "moderated_by", "moderated_at"].includes(key))) assert.deepEqual(row[key], original[key], key);
  assert.equal((await pool.query("SELECT * FROM gallery_project_authors WHERE project_id=$1", [id])).rowCount, 2);
  assert.equal((await pool.query("SELECT * FROM gallery_likes WHERE project_id=$1", [id])).rowCount, 1);
  await service.moderateProject(admin, id, "restore", "hidden", null);
  const restored = await service.getAdminProject(admin, id);
  assert.equal(restored?.visibility, "published"); assert.equal(restored?.moderationReason, null);
  assert.equal(restored?.likes, 8); assert.equal(restored?.authors.length, 2);
  assert.equal((await service.listAdminProjects(admin, { query: prefix, visibility: "hidden" })).total, 0);
});

// The extra boundary row can exist even when the requested page has disappeared.
test("batch clamping rebuilds the last valid page instead of returning only its boundary", async () => {
  const query = `Boundary ${prefix}`;
  await pool.query("UPDATE gallery_projects SET title=$1 WHERE id=ANY($2::text[])", [query, ids.slice(0, SIZE)]);
  const batch = await service.readAdminProjectPage(admin, { query, turmaId: group, page: 2 });
  assert.equal(batch.total, SIZE); assert.equal(batch.page, 1); assert.equal(batch.previousId, null);
  assert.equal(batch.items.length, SIZE); assert.equal(batch.hasMore, false);
});
