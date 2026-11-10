import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomInt, randomUUID } from "node:crypto";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { assertDatabaseTarget, assertRuntimeTarget } from "../src/lib/database-target.cjs";
import { COLLECTION_PAGE_SIZE as SIZE, INITIAL_COLLECTION_PAGES } from "../src/lib/collection-page";
import { readGalleryFilters } from "../src/lib/gallery-filters";

let pool: typeof import("../src/db").pool;
let client: PoolClient;
let connection: Pick<ReturnType<typeof drizzle>, "select" | "execute">;
let queries: typeof import("../src/lib/queries");
const require = createRequire(`${process.cwd()}/package.json`);
const headersId = require.resolve("next/headers"), originalHeaders = require.cache[headersId];
let visitor: string | undefined;
const statements: string[] = [];
const prefix = `reads-${randomUUID()}`, owner = randomUUID(), coauthor = randomUUID(), other = randomUUID();
const group = randomUUID(), secondGroup = randomUUID();
const ids: string[] = Array.from({ length: SIZE * 2 + 6 }, () => randomUUID());

before(async () => {
  const loaded = config({ path: process.env.GALLERY_READ_TEST_ENV_FILE || ".env.admin-test", override: true, quiet: true });
  if (loaded.error && !(process.env.CI && process.env.GALLERY_LOCAL_TEST_DATABASE === "1")) throw loaded.error;
  delete process.env.VERCEL_ENV; delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  assertRuntimeTarget(process.env.DATABASE_URL!);
  ({ pool } = await import("../src/db"));
  await assertDatabaseTarget(pool, process.env, "test");
  client = await pool.connect(); await client.query("BEGIN");
  connection = drizzle(client, { logger: { logQuery: query => { statements.push(query); } } });
  require.cache[headersId] = { id: headersId, filename: headersId, loaded: true, exports: { cookies: async () => ({ get: () => visitor ? { value: visitor } : undefined }) } } as NodeJS.Module;
  queries = await import("../src/lib/queries");
  const number = randomInt(1000000, 800000000);
  for (const [index, id] of [group, secondGroup].entries()) await client.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year,archived_at) VALUES($1,$2,$3,'Fixture',2026,now())", [id, `Turma ${number + index}`, number + index]);
  for (const [id, name] of [[owner, `João ${prefix}`], [coauthor, `Coautor ${prefix}`], [other, `Outro ${prefix}`]]) {
    await client.query("INSERT INTO gallery_users(id,slug,name,email,status,email_verified) VALUES($1,$2,$3,$4,'active',true)", [id, `${prefix}-${id}`, name, `${id}@example.invalid`]);
    await client.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [id, id === other ? secondGroup : group]);
  }
  for (const [index, id] of ids.entries()) {
    const author = index === ids.length - 1 ? other : owner;
    await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,base_likes,is_final,created_at) VALUES($1,$2,$3,$4,$5,'https://github.com',$6,$7,$8,$9,$10)",
      [id, `${prefix}-${index}`, `${prefix} ${String(index).padStart(2, '0')}`, `Descrição com acentuação ${prefix}`, JSON.stringify(index % 2 ? ['React', 'CSS'] : ['HTML']), author, index === ids.length - 1 ? secondGroup : group, index, index % 2 === 0, new Date(Date.UTC(2026, 0, 1, 0, 0, index))]);
    await client.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)", [id, author]);
    if (index < 3) await client.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)", [id, coauthor]);
  }
  await client.query("UPDATE gallery_projects SET visibility='hidden',moderation_reason='Fixture reason',moderated_by=$1,moderated_at=now() WHERE id=$2", [owner, ids[0]]);
  await client.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES($1,$2),($1,$3)", [ids[1], `${prefix}-browser`, `${prefix}-other`]);
});
after(async () => {
  try { if (client) await client.query("ROLLBACK"); }
  finally {
    client?.release(); await pool?.end();
    if (originalHeaders) require.cache[headersId] = originalHeaders; else delete require.cache[headersId];
  }
});

test("public reads preserve author credits, archived turmas, real/base likes and browser isolation", async () => {
  visitor = `${prefix}-browser`;
  const rows = await queries.readProjectPage(filters(), { kind: 'gallery' }, connection);
  assert.equal(rows.total, ids.length - 1); assert(!rows.items.some(project => project.id === ids[0]));
  const shared = (await queries.readProject({ id: ids[1] }, connection))!;
  assert.deepEqual(shared.authors.map(person => person.id), [owner, coauthor]);
  assert.equal(shared.likes, 3); assert.equal(shared.liked, true);
  assert.equal(shared.moderationReason, null);
  visitor = `${prefix}-unknown`;
  assert.equal((await queries.readProject({ id: ids[1] }, connection))?.liked, false);
});

test("a participant sees a hidden shared project but only its owner sees the moderation reason", async () => {
  const ownerView = await queries.readProject({ id: ids[0], participantId: owner }, connection);
  const coauthorView = await queries.readProject({ id: ids[0], participantId: coauthor }, connection);
  const unrelatedView = await queries.readProject({ id: ids[0], participantId: other }, connection);
  assert.equal(ownerView?.moderationReason, 'Fixture reason');
  assert.equal(coauthorView?.visibility, 'hidden'); assert.equal(coauthorView?.moderationReason, null);
  assert.equal(unrelatedView, null);
});

const filters = (values: Record<string, string> = {}) => readGalleryFilters(new URLSearchParams({ q: prefix, ...values }));

test("gallery pages select configured matching batches; restore, clamping and stable ordering retain URL behavior", async () => {
  statements.length = 0;
  const first = await queries.readProjectPage(filters(), { kind: 'gallery' }, connection);
  assert.equal(statements.length, 1, 'A populated batch must not add per-project or per-author database round trips');
  const next = await queries.readProjectPage(filters({ page: '2' }), { kind: 'gallery' }, connection);
  assert.equal(first.total, ids.length - 1); assert.equal(first.items.length, SIZE); assert.equal(next.items.length, SIZE);
  assert.equal(first.previousId, null); assert.equal(next.previousId, first.items.at(-1)?.id); assert.equal(next.hasMore, true);
  for (const item of first.items) for (const field of ['description', 'githubUrl', 'liveUrl', 'version', 'imageMetadata', 'moderatedBy']) assert.equal(field in item, false, `List payload must omit ${field}`);
  assert.deepEqual(first.items.map(project => project.id), ids.slice(-SIZE).reverse());
  assert(!next.items.some(project => first.items.some(previous => previous.id === project.id)));
  const restored = await queries.readInitialProjects(filters({ page: '2' }), { kind: 'gallery' }, connection);
  assert.deepEqual(restored.items.map(project => project.id), [...first.items, ...next.items].map(project => project.id));
  const last = await queries.readProjectPage(filters({ page: '999999999' }), { kind: 'gallery' }, connection);
  assert.equal(last.page, 3); assert.equal(last.items.length, 5);
});

test("SQL search preserves accent-insensitive text, authors, literal input, AND technologies and final selection", async () => {
  const searched = await queries.readProjectPage(filters({ q: `Descricao com acentuacao ${prefix}` }), { kind: 'gallery' }, connection);
  assert.equal(searched.total, ids.length - 1);
  assert.equal((await queries.readProjectPage(filters({ q: `joao ${prefix}` }), { kind: 'gallery' }, connection)).total, ids.length - 2);
  assert.equal((await queries.readProjectPage(filters({ q: "' OR true --" }), { kind: 'gallery' }, connection)).total, 0);
  const technology = { ...filters(), techs: ['React', 'CSS'] };
  assert.equal((await queries.readProjectPage(technology, { kind: 'gallery' }, connection)).total, Math.floor(ids.length / 2));
  assert.equal((await queries.readProjectPage({ ...technology, finalOnly: true }, { kind: 'gallery' }, connection)).total, 0);
  const sorted = await queries.readProjectPage(filters({ sort: 'likes' }), { kind: 'gallery' }, connection);
  assert(sorted.items.every((project, index) => !index || project.likes <= sorted.items[index - 1].likes));
  const az = await queries.readProjectPage(filters({ sort: 'az' }), { kind: 'gallery' }, connection);
  assert.deepEqual(az.items.map(project => project.id), ids.slice(1, SIZE + 1));
});

test("gallery turma filters and choices follow the publication, independent of authors' current memberships", async () => {
  await client.query("SAVEPOINT publication_turma_filter");
  try {
    const projectTurma = randomUUID(), currentTurma = randomUUID(), hiddenTurma = randomUUID();
    const author = randomUUID(), contributor = randomUUID(), publication = randomUUID(), hidden = randomUUID();
    const number = randomInt(800000001, 900000000), query = `${prefix}-turma-filter`;
    const originalName = `Turma ${number}`, currentName = `Turma ${number + 1}`, hiddenName = `Turma ${number + 2}`;
    for (const [index, id] of [projectTurma, currentTurma, hiddenTurma].entries()) {
      await client.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year,archived_at) VALUES($1,$2,$3,'Fixture',2026,$4)",
        [id, `Turma ${number + index}`, number + index, index === 0 ? new Date() : null]);
    }
    for (const id of [author, contributor]) {
      await client.query("INSERT INTO gallery_users(id,slug,name,email,status,email_verified,primary_turma_id) VALUES($1,$2,'Fixture',$3,'active',true,$4)",
        [id, `${prefix}-${id}`, `${id}@example.invalid`, projectTurma]);
      await client.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2),($1,$3)", [id, projectTurma, currentTurma]);
    }
    for (const [id, turma] of [[publication, projectTurma], [hidden, hiddenTurma]]) {
      await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id) VALUES($1,$2,$3,'Fixture','[\"React\"]','https://github.com',$4,$5)",
        [id, `${query}-${id}`, query, author, turma]);
      await client.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)", [id, author]);
    }
    await client.query("UPDATE gallery_projects SET visibility='hidden',moderation_reason='Fixture reason',moderated_by=$1,moderated_at=now() WHERE id=$2", [author, hidden]);
    await client.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)", [publication, contributor]);
    const check = async () => {
      const selected = filters({ q: query, cohort: String(number) });
      assert.equal(selected.cohort, originalName);
      const batch = await queries.readProjectPage(selected, { kind: 'gallery' }, connection);
      const initial = await queries.readInitialProjects(selected, { kind: 'gallery' }, connection);
      assert.equal(batch.total, 1); assert.equal(batch.hasMore, false);
      assert.deepEqual(batch.items.map(item => item.id), [publication]);
      assert.deepEqual(initial.items.map(item => item.id), [publication]);
      assert.equal((await queries.readProjectPage(filters({ q: query, cohort: String(number + 1) }), { kind: 'gallery' }, connection)).total, 0);
      assert.equal((await queries.readProjectPage(filters({ q: query, cohort: String(number + 2) }), { kind: 'gallery' }, connection)).total, 0);
      const choices = (await queries.getGalleryFilterOptions(connection)).cohorts;
      assert(choices.includes(originalName), 'Archived publication turmas remain discoverable');
      assert(!choices.includes(currentName), 'Membership-only turmas must not become gallery choices');
      assert(!choices.includes(hiddenName), 'Hidden publications must not add gallery choices');
    };
    await check();
    await client.query("UPDATE gallery_users SET primary_turma_id=$1 WHERE id=ANY($2::text[])", [currentTurma, [author, contributor]]);
    await check();
    await client.query("DELETE FROM gallery_turma_members WHERE turma_id=$1 AND user_id=ANY($2::text[])", [projectTurma, [author, contributor]]);
    await client.query("UPDATE gallery_users SET primary_turma_id=null WHERE id=$1", [contributor]);
    await check();
    const detail = await queries.readProject({ id: publication }, connection);
    assert.equal(detail?.turmaId, projectTurma);
    assert.deepEqual(detail?.authors.map(person => person.id), [author, contributor]);
    const profile = await queries.readProjectPage(filters(), { kind: 'profile', userId: contributor }, connection);
    assert.deepEqual(profile.items.map(item => item.id), [publication], 'Authorship remains independent of membership');
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT publication_turma_filter");
    await client.query("RELEASE SAVEPOINT publication_turma_filter");
  }
});

test("specific project and participant readers enforce visibility and ownership in SQL", async () => {
  statements.length = 0;
  assert.equal((await queries.readProject({ id: ids[1] }, connection))?.id, ids[1]);
  assert.equal(statements.length, 1, 'A detail read hydrates this project in one database round trip');
  assert.equal(await queries.readProject({ id: ids[0] }, connection), null);
  assert.equal(await queries.readProject({ id: ids[0], participantId: other }, connection), null);
  assert.equal((await queries.readProject({ id: ids[0], participantId: owner, ownerOnly: true }, connection))?.moderationReason, 'Fixture reason');
  assert.equal(await queries.readProject({ id: ids[0], participantId: coauthor, ownerOnly: true }, connection), null);
  const mine = await queries.readProjectPage(filters(), { kind: 'mine', userId: coauthor }, connection);
  assert.equal(mine.total, 3); assert.equal(mine.items.find(project => project.id === ids[0])?.moderationReason, null);
  const unrelated = await queries.readProjectPage(filters(), { kind: 'mine', userId: other }, connection);
  assert.deepEqual(unrelated.items.map(project => project.id), [ids.at(-1)!]);
  const profile = await queries.readProjectPage(filters(), { kind: 'profile', userId: coauthor }, connection);
  assert.equal(profile.total, 2); assert(profile.items.every(project => project.visibility === 'published'));
  assert.deepEqual(await queries.getProfileProjectStats(coauthor, connection), { total: 2, totalLikes: 5 });
});

test("related projects and community statistics use published author credits without duplication", async () => {
  const project = (await queries.readProject({ id: ids[1] }, connection))!;
  const related = await queries.getRelatedProjects(project, connection);
  assert.equal(related.length, 3); assert(related.every(item => item.author.id === owner && item.id !== project.id && item.visibility === 'published'));
  await client.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [coauthor, secondGroup]);
  const community = await queries.readCommunityPage(filters(), connection);
  assert.equal(community.total, 3);
  assert.equal(community.items.filter(person => person.id === coauthor).length, 1);
  assert.equal(community.items.find(person => person.id === owner)?.totalLikes, (ids.length - 2) * (ids.length - 1) / 2 + 2);
  assert.equal(community.items.find(person => person.id === coauthor)?.projectCount, 2);
  const facets = await queries.getGalleryFilterOptions(connection);
  assert(facets.technologies.includes('React')); assert(facets.cohorts.length >= 2);
  assert.deepEqual(community.items.find(person => person.id === coauthor)?.cohorts.length, 2);
});

test("community pages remain bounded, unique and exclude unverified and no-turma profiles", async () => {
  for (let index = 0; index < SIZE + 6; index++) {
    const id = randomUUID(), demo = index === SIZE + 5, pending = index === SIZE + 4, noGroup = index === SIZE + 3;
    await client.query("INSERT INTO gallery_users(id,name,email,status,email_verified,is_demo) VALUES($1,$2,$3,$4,$5,$6)", [id, `Pessoa ${prefix} ${index}`, `${id}@example.invalid`, pending || demo ? 'pending' : 'active', !pending && !demo, demo]);
    if (!noGroup) await client.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [id, group]);
  }
  const first = await queries.readCommunityPage(filters(), connection);
  const second = await queries.readCommunityPage(filters({ page: '2' }), connection);
  assert.equal(first.total, SIZE + 7); assert.equal(first.items.length, SIZE); assert.equal(second.items.length, 7);
  assert.equal(new Set([...first.items, ...second.items].map(person => person.id)).size, SIZE + 7);
  const restored = await queries.readInitialCommunity(filters({ page: '2' }), connection);
  assert.equal(restored.items.length, SIZE + 7);
  const coauthorPerson = restored.items.find(person => person.id === coauthor)!;
  assert.equal(coauthorPerson.totalLikes, 5);
  assert.deepEqual(Object.keys(coauthorPerson).filter(key => ['email', 'password', 'role', 'status'].includes(key)), []);
});

test("initial snapshots bound huge URL pages before SQL execution", async () => {
  statements.length = 0;
  const initial = await queries.readInitialProjects(filters({ page: String(Number.MAX_SAFE_INTEGER) }), { kind: 'gallery' }, connection);
  assert(initial.items.length <= INITIAL_COLLECTION_PAGES * SIZE);
  assert(initial.loadedPages <= INITIAL_COLLECTION_PAGES);
  assert.equal(statements.length, 1);
  const people = await queries.readInitialCommunity(filters({ page: '999999999' }), connection);
  assert(people.items.length <= INITIAL_COLLECTION_PAGES * SIZE);
});

test("community rankings sort the full matching set before pagination and preserve public credit totals", async () => {
  await client.query("SAVEPOINT community_rankings");
  try {
    const query = `${prefix}-ranking`, turma = randomUUID(), extraTurma = randomUUID();
    const number = randomInt(800000001, 900000000);
    for (const [index, id] of [turma, extraTurma].entries()) {
      await client.query("INSERT INTO gallery_turmas(id,name,number) VALUES($1,$2,$3)", [id, `Turma ${number + index}`, number + index]);
    }
    const people = Array.from({ length: SIZE + 5 }, (_, index) => ({
      id: randomUUID(), name: `${query} ${index < 2 ? 'Mesmo nome' : String(index).padStart(2, '0')}`, projectCount: 0, totalLikes: 0,
    }));
    for (const [index, person] of people.entries()) {
      await client.query("INSERT INTO gallery_users(id,slug,name,email,status,email_verified) VALUES($1,$2,$3,$4,'active',true)",
        [person.id, `${query}-${person.id}`, person.name, `${person.id}@example.invalid`]);
      await client.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [person.id, turma]);
      if (index % 2 === 0) await client.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [person.id, extraTurma]);
      const count = index === people.length - 1 ? 4 : index === people.length - 2 ? 1 : index % 3;
      for (let publication = 0; publication < count; publication++) {
        const id = randomUUID(), base = index === people.length - 2 ? 5000 : index + 1;
        await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,base_likes) VALUES($1,$2,'Ranking','Fixture','[]','https://github.com',$3,$4,$5)",
          [id, `${query}-${id}`, person.id, turma, base]);
        // The owner also has a credit row: this must never double the statistics.
        await client.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)", [id, person.id]);
        await client.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES($1,'fixture')", [id]);
        person.projectCount++; person.totalLikes += base + 1;
        if (index === people.length - 1 && publication === 0) {
          await client.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)", [id, people[2].id]);
          people[2].projectCount++; people[2].totalLikes += base + 1;
        }
      }
    }
    const hidden = randomUUID();
    await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,base_likes,visibility,moderation_reason,moderated_by,moderated_at) VALUES($1,$2,'Hidden','Fixture','[]','https://github.com',$3,$4,999999,'hidden','Fixture',$3,now())",
      [hidden, `${query}-${hidden}`, people[0].id, turma]);
    const collator = new Intl.Collator('pt-BR');
    const byName = (a: typeof people[number], b: typeof people[number]) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
    for (const sort of ['az', 'projects', 'likes'] as const) {
      const expected = [...people].sort((a, b) => (sort === 'projects' ? b.projectCount - a.projectCount : sort === 'likes' ? b.totalLikes - a.totalLikes : 0) || byName(a, b));
      const selected = (page = '1', cohort = String(number)) => readGalleryFilters(new URLSearchParams({ q: query, cohort, sort, page }), 'community');
      statements.length = 0;
      const first = await queries.readCommunityPage(selected(), connection);
      assert.equal(statements.length, 2, 'One bounded SQL/statistics read and one selected-profile read');
      const second = await queries.readCommunityPage(selected('2'), connection);
      assert.equal(first.total, people.length); assert.equal(first.items.length, SIZE); assert.equal(first.hasMore, true);
      assert.equal(second.previousId, first.items.at(-1)?.id); assert.equal(second.hasMore, false);
      const combined = [...first.items, ...second.items];
      assert.deepEqual(combined.map(person => person.id), expected.map(person => person.id));
      for (const actual of combined) {
        const person = people.find(person => person.id === actual.id)!;
        assert.equal(actual.projectCount, person.projectCount); assert.equal(actual.totalLikes, person.totalLikes);
      }
      const restored = await queries.readInitialCommunity(selected('2'), connection);
      assert.deepEqual(restored.items.map(person => person.id), expected.map(person => person.id));
      const clamped = await queries.readCommunityPage(selected('999999999'), connection);
      assert.equal(clamped.page, 2); assert.deepEqual(clamped.items.map(person => person.id), second.items.map(person => person.id));
      const scoped = await queries.readCommunityPage(selected('1', String(number + 1)), connection);
      const eligible = new Set(people.filter((_, index) => index % 2 === 0).map(person => person.id));
      assert.equal(scoped.total, eligible.size);
      assert.deepEqual(scoped.items.map(person => person.id), expected.filter(person => eligible.has(person.id)).map(person => person.id));
    }
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT community_rankings");
    await client.query("RELEASE SAVEPOINT community_rankings");
  }
});

test("batch boundary changes identify insertions, removals and reordered records", async () => {
  const first = await queries.readProjectPage(filters(), { kind: 'gallery' }, connection);
  const expected = first.items.at(-1)!.id;
  await client.query("UPDATE gallery_projects SET created_at='2099-01-01' WHERE id=$1", [ids[1]]);
  const second = await queries.readProjectPage(filters({ page: '2' }), { kind: 'gallery' }, connection);
  assert.notEqual(second.previousId, expected); assert.equal(second.total, first.total);
  await client.query("UPDATE gallery_projects SET visibility='hidden', moderation_reason='Fixture', moderated_by=$1, moderated_at=now() WHERE id=$2", [owner, ids[2]]);
  const afterHide = await queries.readProjectPage(filters({ page: '2' }), { kind: 'gallery' }, connection);
  assert.equal(afterHide.total, first.total - 1);
});
