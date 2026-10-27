import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomInt, createHash } from "node:crypto";
import { config } from "dotenv";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";
import { adminProjectHref, adminProjectReturn, parseAdminProjectFilters } from "../src/lib/admin-project-params";

let pool: typeof import("../src/db").pool;
let service: typeof import("../src/lib/admin-projects");
const prefix = `moderation-${randomUUID()}`;
const admin = randomUUID(), student = randomUUID(), coauthor = randomUUID(), suspended = randomUUID();
const group = randomUUID(), otherGroup = randomUUID(), ids = Array.from({ length: 14 }, () => randomUUID());
let baseline: Record<string, string>;
async function snapshot() {
  const result: Record<string, string> = {};
  for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'gallery_%'")).rows) {
    result[tablename] = createHash("sha256").update(JSON.stringify((await pool.query(`SELECT * FROM "${tablename}"`)).rows.map(row => JSON.stringify(row)).sort())).digest("hex");
  }
  return result;
}
before(async () => {
  config({ path: ".env.admin-test", override: true, quiet: true });
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
    await pool.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,base_likes,is_final,created_at) VALUES($1,$2,$3,'Keep this content','[\"React\"]','https://github.com',$4,$5,7,true,$6)", [id, `${prefix}-${index}`, `${prefix} ${index}`, student, index === 13 ? otherGroup : group, new Date(2026, 0, 1, 0, 0, index)]);
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
    await assert.rejects(() => service.moderateProject(actor, ids[0], "hide", "published", "Reason"), /restrito/);
  }
});
test("incremental loading searches all coauthors, retains earlier cards and filters archived turmas", async () => {
  const filters = { query: `joao ${prefix}`, turmaId: group };
  const first = await service.listAdminProjects(admin, filters);
  assert.equal(first.total, 13); assert.equal(first.projects.length, 9);
  const second = await service.listAdminProjects(admin, { ...filters, page: 2 });
  assert.equal(second.projects.length, 13);
  assert.deepEqual(second.projects.slice(0, 9).map(project => project.id), first.projects.map(project => project.id));
  assert.equal(new Set(second.projects.map(project => project.id)).size, 13);
  const beyondInitial = await service.listAdminProjects(admin, { query: `${prefix} 0`, turmaId: group });
  assert.equal(beyondInitial.total, 1); assert.equal(beyondInitial.projects[0].id, ids[0]);
  assert.equal((await service.listAdminProjects(admin, { ...filters, page: 100 })).filters.page, 2);
  assert.equal((await service.listAdminProjects(admin, { query: prefix + "-nothing" })).total, 0);
  assert.equal(first.projects[0].authors.length, 2); assert.equal(first.projects[0].likes, 8);
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
  assert.equal(list.total, 1); assert.equal(list.projects[0].id, id);
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
