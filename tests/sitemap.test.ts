import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { assertDatabaseTarget, assertRuntimeTarget } from "../src/lib/database-target.cjs";

let pool: typeof import("../src/db").pool;
let client: PoolClient;
let connection: Pick<ReturnType<typeof drizzle>, "select">;
let records: typeof import("../src/lib/queries").getSitemapRecords;
let group: string, archivedGroup: string, admin: string;
const prefix = `sitemap-${randomUUID()}`;

async function user(label: string, { verified = true, demo = false, role = "user", member = true } = {}) {
  const id = randomUUID(), slug = `${prefix}-${label}`;
  await client.query("INSERT INTO gallery_users(id,slug,name,email,status,email_verified,is_demo,role) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, slug, label, `${slug}@example.invalid`, verified ? "active" : "pending", verified, demo, role]);
  if (member) await client.query("INSERT INTO gallery_turma_members(turma_id,user_id) VALUES($1,$2)", [group, id]);
  return { id, slug };
}

before(async () => {
  const loaded = config({ path: process.env.GALLERY_SITEMAP_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  if (loaded.error && !(process.env.CI && process.env.GALLERY_LOCAL_TEST_DATABASE === "1")) throw loaded.error;
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  ({ pool } = await import("../src/db"));
  await assertDatabaseTarget(pool, process.env, "test");
  client = await pool.connect();
  await client.query("BEGIN");
  connection = drizzle(client);
  ({ getSitemapRecords: records } = await import("../src/lib/queries"));
  group = randomUUID(); archivedGroup = randomUUID();
  const number = randomInt(1000000, 800000000);
  await client.query("INSERT INTO gallery_turmas(id,name,number,archived_at) VALUES($1,$2,$3,NULL),($4,$5,$6,now())",
    [group, `${prefix}-group`, number, archivedGroup, `${prefix}-archived`, number + 1]);
  admin = (await user("admin", { role: "admin", member: false })).id;
});

after(async () => {
  try { if (client) await client.query("ROLLBACK"); }
  finally { client?.release(); await pool?.end(); }
});

test("sitemap profiles follow community eligibility, including roles, demos and archived turmas", async () => {
  const verified = await user("verified");
  const pending = await user("pending", { verified: false });
  const demo = await user("demo", { verified: false, demo: true });
  const staff = await user("staff", { role: "admin" });
  const noGroup = await user("no-group", { member: false });
  const archived = await user("archived");
  await client.query("INSERT INTO gallery_turma_members(turma_id,user_id) VALUES($1,$2),($1,$3)", [archivedGroup, verified.id, archived.id]);
  await client.query("DELETE FROM gallery_turma_members WHERE turma_id=$1 AND user_id=$2", [group, archived.id]);
  const result = await records(connection);
  const actual = result.people.filter(row => row.slug.startsWith(prefix));
  assert.deepEqual(actual.map(row => row.slug).sort(), [verified.slug, demo.slug, staff.slug, archived.slug].sort());
  assert.equal(actual.filter(row => row.slug === verified.slug).length, 1, "Multiple turmas must not duplicate a profile");
  assert(!actual.some(row => [pending.slug, noGroup.slug].includes(row.slug)));
  for (const row of actual) assert.deepEqual(Object.keys(row), ["slug"], "No private profile values in sitemap data");
});

test("activation and membership changes affect the next sitemap query", async () => {
  const pending = await user("activate", { verified: false });
  const included = async () => (await records(connection)).people.some(row => row.slug === pending.slug);
  assert.equal(await included(), false);
  await client.query("UPDATE gallery_users SET email_verified=true,status='active' WHERE id=$1", [pending.id]);
  assert.equal(await included(), true);
  await client.query("DELETE FROM gallery_turma_members WHERE user_id=$1", [pending.id]);
  assert.equal(await included(), false);
});

test("publishing, moderation, updates and deletion affect sitemap records without private fields", async () => {
  const owner = await user("author"), id = randomUUID(), slug = `${prefix}-project`;
  // Drizzle interprets timestamp-without-timezone as UTC; raw pg uses the host TZ.
  const inserted = await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id) VALUES($1,$2,'Fixture','Description','[]','https://github.com',$3,$4) RETURNING updated_at AT TIME ZONE 'UTC' AS updated_at", [id, slug, owner.id, group]);
  const current = async () => (await records(connection)).projects.find(row => row.slug === slug);
  assert.deepEqual(await current(), { slug, updatedAt: inserted.rows[0].updated_at });
  const changed = await client.query("UPDATE gallery_projects SET title='Updated fixture',updated_at=updated_at + interval '1 minute' WHERE id=$1 RETURNING updated_at AT TIME ZONE 'UTC' AS updated_at", [id]);
  assert.deepEqual(await current(), { slug, updatedAt: changed.rows[0].updated_at });
  await client.query("UPDATE gallery_projects SET visibility='hidden',moderation_reason='Fixture',moderated_by=$2,moderated_at=now() WHERE id=$1", [id, admin]);
  assert.equal(await current(), undefined);
  await client.query("UPDATE gallery_projects SET visibility='published',moderation_reason=NULL,moderated_by=NULL,moderated_at=NULL WHERE id=$1", [id]);
  assert.ok(await current());
  await client.query("DELETE FROM gallery_projects WHERE id=$1", [id]);
  assert.equal(await current(), undefined);
});

test("a database failure propagates instead of returning an incomplete successful sitemap", async () => {
  const failure = new Error("Fixture database unavailable");
  const unavailable = { select() { throw failure; } } as unknown as typeof connection;
  await assert.rejects(() => records(unavailable), error => error === failure);
});
