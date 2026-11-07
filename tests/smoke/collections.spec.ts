import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { assertDatabaseTarget } from "../../src/lib/database-target.cjs";
import { COLLECTION_PAGE_SIZE as SIZE, INITIAL_COLLECTION_PAGES } from "../../src/lib/collection-page";
import { fixture } from "./setup";

const prefix = `collection-${randomUUID()}`;
const PROJECT_COUNT = SIZE * 4 + 3;
const IMAGE_INDEX = PROJECT_COUNT - 2;
const ids: string[] = Array.from({ length: PROJECT_COUNT }, () => randomUUID());
const people: string[] = Array.from({ length: SIZE + 4 }, () => randomUUID());
let pool: Pool, studentSlug: string;
let verified = false;

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await assertDatabaseTarget(pool, process.env, "test");
  verified = true;
  const data = fixture(), client = await pool.connect();
  try {
    await client.query('BEGIN');
    studentSlug = (await client.query('SELECT slug FROM gallery_users WHERE id=$1', [data.studentId])).rows[0].slug;
    for (const [index, id] of ids.entries()) {
      await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,is_final,created_at,image_url,cover_framing) VALUES($1,$2,$3,$4,'[\"React\",\"CSS\"]','https://github.com',$5,$6,$7,$8,$9,$10)",
        [id, `${prefix}-${index}`, `${prefix} ${String(index).padStart(2, '0')}`, `Uma descrição para testar as listas ${prefix}.`, data.studentId, data.turmaId, index % 2 === 0, new Date(Date.UTC(2026, 0, 1, 0, 0, index)), index === IMAGE_INDEX ? '/favicon.svg' : null, index === IMAGE_INDEX ? { x: 23, y: 60, zoom: 1.3 } : null]);
      await client.query('INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)', [id, data.studentId]);
    }
    await client.query("UPDATE gallery_projects SET visibility='hidden',moderation_reason='Fixture hidden reason',moderated_at=now(),moderated_by=$1 WHERE id=$2", [data.adminId, ids.at(-1)!]);
    for (const [index, id] of people.entries()) {
      await client.query("INSERT INTO gallery_users(id,name,email,status,email_verified) VALUES($1,$2,$3,'active',true)", [id, `Pessoa ${prefix} ${index}`, `${id}@example.invalid`]);
      await client.query('INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)', [id, data.turmaId]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});
test.afterAll(async () => {
  if (!pool) return;
  if (!verified) { await pool.end(); return; }
  try {
    await pool.query('DELETE FROM gallery_projects WHERE id=ANY($1::text[])', [ids]);
    await pool.query('DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[])', [people]);
    await pool.query('DELETE FROM gallery_users WHERE id=ANY($1::text[])', [people]);
  } finally { await pool.end(); }
});

test('gallery requests bounded records per batch and restores cumulative URL state after reload', async ({ page, request }) => {
  const response = await request.get(`/api/projects?view=gallery&q=${prefix}&page=2`);
  const body = await response.json();
  expect(body.items).toHaveLength(SIZE); expect(body.total).toBe(PROJECT_COUNT - 1);
  expect(body.items.every((item: Record<string, unknown>) => !('description' in item) && !('version' in item))).toBe(true);
  expect(JSON.stringify(body)).not.toContain('Fixture hidden reason');
  expect((await request.get('/api/projects?view=mine')).status()).toBe(401);
  const profile = await (await request.get(`/api/projects?view=profile&slug=${studentSlug}`)).json();
  expect(profile.items).toHaveLength(SIZE); expect(profile.total).toBe(PROJECT_COUNT);
  await page.goto(`/?q=${prefix}`);
  await expect(page.locator('.project-card')).toHaveCount(SIZE);
  const image = page.locator(`a[href="/projetos/${prefix}-${IMAGE_INDEX}"] .custom-cover-image`);
  await expect(image).toHaveCSS('object-position', '23% 60%');
  await page.getByRole('button', { name: 'Carregar mais projetos', exact: true }).click();
  await expect(page.locator('.project-card')).toHaveCount(SIZE * 2);
  await expect(page).toHaveURL(/page=2/);
  await page.reload(); await expect(page.locator('.project-card')).toHaveCount(SIZE * 2);
  await page.getByRole('button', { name: 'Carregar mais projetos', exact: true }).click();
  await expect(page.locator('.project-card')).toHaveCount(SIZE * 3);
  while (await page.getByRole('button', { name: 'Carregar mais projetos', exact: true }).count()) {
    const button = page.getByRole('button', { name: 'Carregar mais projetos', exact: true });
    await expect(button).toBeEnabled(); await button.click();
    await expect(page.locator('.project-grid')).toHaveAttribute('aria-busy', 'false');
  }
  await expect(page.locator('.project-card')).toHaveCount(PROJECT_COUNT - 1);
  const links = await page.locator('.project-cover-link').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(new Set(links).size).toBe(PROJECT_COUNT - 1);
});

test('a failed next batch preserves cards and recovers without duplicates', async ({ page }) => {
  await page.goto(`/?q=${prefix}`);
  let fail = true;
  await page.route('**/api/projects?**', route => {
    if (new URL(route.request().url()).searchParams.get('page') === '2' && fail) { fail = false; return route.abort(); }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Carregar mais projetos', exact: true }).click();
  await expect(page.locator('.collection-feedback [role="alert"]')).toContainText('conexão');
  await expect(page.locator('.project-card')).toHaveCount(SIZE);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.project-card')).toHaveCount(SIZE * 2);
  await expect(page.locator('.collection-feedback [role="alert"]')).toHaveCount(0);
});

test('new searches discard late responses; Back restores the prior filter and first batch', async ({ page, request }) => {
  const stale = await (await request.get(`/api/projects?view=gallery&q=${prefix}+00`)).json();
  await page.goto(`/?q=${prefix}`);
  let release!: () => void, entered!: () => void, finished!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const done = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/api/projects?**', async route => {
    if (new URL(route.request().url()).searchParams.get('q') === `${prefix} 00`) {
      entered(); await gate;
      try { await route.fulfill({ json: stale }); } catch { /* This request was intentionally aborted. */ }
      finally { finished(); }
    } else await route.continue();
  });
  const search = page.getByRole('textbox', { name: 'Buscar projetos' });
  await search.fill(`${prefix} 00`); await started;
  await search.fill(`${prefix} ${IMAGE_INDEX}`);
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('.project-cover-link')).toHaveAttribute('href', `/projetos/${prefix}-${IMAGE_INDEX}`);
  release(); await done;
  await expect(page.locator('.project-cover-link')).toHaveAttribute('href', `/projetos/${prefix}-${IMAGE_INDEX}`);
  await search.fill(prefix); await expect(page.locator('.project-card')).toHaveCount(SIZE);
  await page.getByRole('button', { name: 'Projetos finais', exact: true }).click();
  await expect(page).toHaveURL(/final=1/);
  await expect(page.locator('.results-count')).toContainText(String(Math.ceil((PROJECT_COUNT - 1) / 2)));
  await page.goBack(); await expect(page.locator('.results-count')).toContainText(String(PROJECT_COUNT - 1));
  await expect(page.locator('.project-card')).toHaveCount(SIZE);
});

test('community and public profile load real batches while retaining complete totals', async ({ page, request }) => {
  const community = await (await request.get(`/api/people?q=${prefix}`)).json();
  expect(community.total).toBe(people.length); expect(community.items).toHaveLength(SIZE);
  await page.goto(`/comunidade?q=${prefix}`);
  await expect(page.locator('.person-card')).toHaveCount(SIZE);
  await page.getByRole('button', { name: 'Carregar mais pessoas', exact: true }).click();
  await expect(page.locator('.person-card')).toHaveCount(people.length);
  await page.reload(); await expect(page.locator('.person-card')).toHaveCount(people.length);
  await page.goto(`/pessoas/${studentSlug}`);
  await expect(page.locator('.profile-projects .project-card')).toHaveCount(SIZE);
  await expect(page.locator('.profile-stats')).toContainText(`${PROJECT_COUNT} projetos`);
  await page.getByRole('button', { name: 'Carregar mais projetos', exact: true }).click();
  await expect(page.locator('.profile-projects .project-card')).toHaveCount(SIZE * 2);
});

test('a prefetched project preserves a like made before navigation', async ({ page }) => {
  await page.goto(`/?q=${prefix}`);
  const card = page.locator('.project-card').filter({ has: page.locator(`a[href="/projetos/${prefix}-${IMAGE_INDEX}"]`) });
  let complete!: () => void;
  const prefetched = new Promise<void>(resolve => { complete = resolve; });
  // A browser prefetch may not emit requestfinished before navigation.
  // Buffer the real server response to establish an old snapshot
  // deterministically, without coupling this regression to that browser event.
  await page.route(`**/projetos/${prefix}-${IMAGE_INDEX}?*`, async route => {
    const headers = route.request().headers();
    if (headers.rsc !== '1' || headers['next-router-segment-prefetch']) return route.continue();
    const response = await route.fetch();
    expect(await response.text()).toContain('"observedAt":');
    await route.fulfill({ response }); complete();
  });
  await card.locator('.project-cover-link').hover();
  await prefetched;
  const like = card.getByRole('button', { name: /curtir projeto/i });
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect(like).toHaveAttribute('aria-busy', 'false');
  await card.locator('.project-cover-link').click();
  await expect(page.locator('.like-full')).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page.locator('.project-card').filter({ has: page.locator(`a[href="/projetos/${prefix}-${IMAGE_INDEX}"]`) }).getByRole('button', { name: /curtir projeto/i })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('.project-card').filter({ has: page.locator(`a[href="/projetos/${prefix}-${IMAGE_INDEX}"]`) }).getByRole('button', { name: /curtir projeto/i })).toHaveAttribute('aria-pressed', 'true');
});

test('private batches require the actual session; deletion refreshes the visible page and total', async ({ page }) => {
  const data = fixture();
  await page.goto('/entrar');
  await page.getByLabel('Email', { exact: true }).fill(data.email);
  await page.getByLabel('Senha', { exact: true }).fill(data.password);
  await page.getByRole('button', { name: 'Entrar com email', exact: true }).click();
  await expect(page).toHaveURL(/\/meus-projetos$/);
  await expect(page.locator('.management-card')).toHaveCount(SIZE);
  await expect(page.locator('.dashboard-summary')).toContainText(`${PROJECT_COUNT + 1} projetos`);
  const mine = await (await page.request.get('/api/projects?view=mine')).json();
  expect(mine.items).toHaveLength(SIZE); expect(mine.total).toBe(PROJECT_COUNT + 1);
  await page.getByRole('button', { name: `Excluir ${prefix} ${IMAGE_INDEX}`, exact: true }).click();
  await page.getByRole('button', { name: 'Sim, excluir', exact: true }).click();
  await expect(page.getByRole('button', { name: `Excluir ${prefix} ${IMAGE_INDEX}`, exact: true })).toHaveCount(0);
  await expect(page.locator('.dashboard-summary')).toContainText(`${PROJECT_COUNT} projetos`);
  await expect(page.locator('.management-card')).toHaveCount(SIZE);
  await page.getByRole('button', { name: 'Carregar mais projetos', exact: true }).click();
  await expect(page.locator('.management-card')).toHaveCount(SIZE * 2);
});

test('default API and unknown URL filters share the bounded contract with server pages', async ({ page, request }) => {
  const body = await (await request.get(`/api/projects?q=${prefix}`)).json();
  expect(body.items).toHaveLength(SIZE); expect(body.hasMore).toBe(true); expect(body.previousId).toBeNull();
  const unknown = `/?tech=${prefix}&cohort=999999999`;
  await page.goto(unknown); await expect(page.locator('.empty-state')).toBeVisible();
  expect((await (await request.get(`/api/projects?${unknown.split('?')[1]}`)).json()).total).toBe(0);
});

test('deep reload bounds initial HTML and restores remaining batches progressively', async ({ page, request }) => {
  const url = `/?q=${prefix}&page=4`;
  const html = await (await request.get(url)).text();
  expect((html.match(/class="project-card"/g) || []).length).toBe(SIZE * INITIAL_COLLECTION_PAGES);
  await page.goto(url); await expect(page.locator('.project-card')).toHaveCount(SIZE * 4);
});

test('insertions during loading rebuild the list and reach the actual end', async ({ page, request }) => {
  const original = await (await request.get(`/api/projects?q=${prefix}`)).json();
  const sample = original.items[0];
  const rows = Array.from({ length: SIZE * 2 }, (_, index) => ({ ...sample, id: `live-${index}` }));
  let dataset = rows;
  await page.route('**/api/projects?**', route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('q') !== `${prefix}-live`) return route.continue();
    const number = Math.min(Number(params.get('page') || 1), Math.ceil(dataset.length / SIZE));
    return route.fulfill({ json: { items: dataset.slice((number - 1) * SIZE, number * SIZE), total: dataset.length,
      page: number, pageSize: SIZE, hasMore: number * SIZE < dataset.length, previousId: dataset[(number - 1) * SIZE - 1]?.id || null } });
  });
  await page.goto(`/?q=${prefix}`);
  await page.getByRole('textbox', { name: 'Buscar projetos' }).fill(`${prefix}-live`);
  await expect(page.locator('.project-card')).toHaveCount(SIZE);
  dataset = [{ ...sample, id: 'new-publication' }, ...rows];
  const more = page.getByRole('button', { name: 'Carregar mais projetos', exact: true });
  await more.click(); await expect(page.locator('.project-card')).toHaveCount(SIZE * 2);
  await expect(more).toBeEnabled(); await more.click();
  await expect(page.locator('.project-card')).toHaveCount(dataset.length);
  await expect(more).toHaveCount(0);
  await expect(page.locator('.load-count')).toContainText(`${dataset.length} de ${dataset.length}`);
});

test('empty search announces loading and a newly mounted card accepts a newer like snapshot', async ({ page, request }) => {
  const sample = (await (await request.get(`/api/projects?q=${prefix}`)).json()).items[0];
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  await page.route('**/api/projects?**', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    if (!q?.startsWith(`${prefix}-snapshot`)) return route.continue();
    if (q.endsWith('wait')) { entered(); await gate; }
    const empty = q.endsWith('empty'), first = q.endsWith('first');
    return route.fulfill({ json: { items: empty ? [] : [{ ...sample, id: 'observed-project', likes: first ? 20 : 30, likesObservedAt: first ? 100 : 200 }],
      total: empty ? 0 : 1, page: 1, pageSize: SIZE, hasMore: false, previousId: null } });
  });
  await page.goto(`/?q=${prefix}`);
  const search = page.getByRole('textbox', { name: 'Buscar projetos' });
  await search.fill(`${prefix}-snapshot-first`);
  await expect(page.locator('.project-card')).toHaveCount(1);
  await expect(page.locator('.project-card .like-count')).toHaveText('20');
  await search.fill(`${prefix}-snapshot-empty`); await expect(page.locator('.empty-state')).toBeVisible();
  await search.fill(`${prefix}-snapshot-wait`); await started;
  await expect(page.locator('.collection-loading')).toContainText('Carregando');
  await expect(page.locator('.empty-state')).toHaveCount(0);
  release(); await expect(page.locator('.project-card .like-count')).toHaveText('30');
});
