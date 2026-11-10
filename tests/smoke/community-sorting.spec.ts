import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { test, expect } from "./fixtures";
import { fixture } from "./setup";
import { assertDatabaseTarget } from "../../src/lib/database-target.cjs";
import { COLLECTION_PAGE_SIZE as SIZE } from "../../src/lib/collection-page";

const prefix = `community-sort-${randomUUID()}`;
const people = Array.from({ length: SIZE + 3 }, () => randomUUID()), projects: string[] = [];
let pool: Pool, verified = false;

test.beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await assertDatabaseTarget(pool, process.env, "test"); verified = true;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [index, id] of people.entries()) {
      await client.query("INSERT INTO gallery_users(id,slug,name,email,status,email_verified) VALUES($1,$2,$3,$4,'active',true)",
        [id, `${prefix}-${index}`, `Pessoa ${prefix} ${String(index).padStart(2, '0')}`, `${id}@example.invalid`]);
      await client.query("INSERT INTO gallery_turma_members(user_id,turma_id) VALUES($1,$2)", [id, fixture().turmaId]);
      for (let count = 0; count <= index % 3; count++) {
        const project = randomUUID(); projects.push(project);
        await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,base_likes) VALUES($1,$2,'Sorting fixture','Fixture','[]','https://github.com',$3,$4,$5)",
          [project, `${prefix}-${project}`, id, fixture().turmaId, index + 1]);
      }
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
});

test.afterAll(async () => {
  if (!pool) return;
  try {
    if (verified) {
      await pool.query("DELETE FROM gallery_projects WHERE id=ANY($1::text[])", [projects]);
      await pool.query("DELETE FROM gallery_turma_members WHERE user_id=ANY($1::text[])", [people]);
      await pool.query("DELETE FROM gallery_users WHERE id=ANY($1::text[])", [people]);
    }
  } finally { await pool.end(); }
});

test("community sorting preserves SQL order through append, reload, filters and browser history", async ({ page, request }, info) => {
  const cards = page.locator(".person-card");
  const links = () => cards.evaluateAll(nodes => nodes.map(node => node.getAttribute("href")));
  async function expected(sort: string, page = 1) {
    const response = await request.get(`/api/people?q=${prefix}&sort=${sort}&page=${page}`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.total).toBe(people.length);
    return data.items.map((person: { slug: string }) => `/pessoas/${person.slug}`) as string[];
  }
  const alphabetical = await expected("az"), ranked = await expected("projects"), liked = await expected("likes");
  expect(ranked).not.toEqual(alphabetical); expect(liked).not.toEqual(ranked);
  await page.goto(`/comunidade?q=${prefix}&page=2`);
  await expect(cards).toHaveCount(people.length);
  await page.getByRole("button", { name: "Ordenar pessoas: Nome: A–Z", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Mais projetos", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=${prefix}&sort=projects$`));
  await expect.poll(links).toEqual(ranked);
  await page.getByRole("button", { name: "Carregar mais pessoas", exact: true }).click();
  await expect.poll(links).toEqual([...ranked, ...await expected("projects", 2)]);
  await expect(page).toHaveURL(/sort=projects&page=2$/);

  await page.getByRole("button", { name: "Ordenar pessoas: Mais projetos", exact: true }).press("Enter");
  await page.getByRole("menuitemradio", { name: "Mais curtidas", exact: true }).press("Enter");
  await expect.poll(links).toEqual(liked);
  await expect(page).toHaveURL(/sort=likes$/);
  await page.reload(); await expect.poll(links).toEqual(liked);
  await page.goBack();
  await expect(page).toHaveURL(/sort=projects&page=2$/);
  await expect(cards).toHaveCount(people.length);
  await expect.poll(links).toEqual([...ranked, ...await expected("projects", 2)]);

  await page.getByRole("button", { name: "Ordenar pessoas: Mais projetos", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Nome: A–Z", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`q=${prefix}$`));
  await expect.poll(links).toEqual(alphabetical);
  await page.getByRole("button", { name: "Todas as turmas", exact: true }).click();
  await page.getByRole("group", { name: "Filtrar por turma", exact: true }).getByRole("button", { name: "Turma 900001", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ordenar pessoas: Nome: A–Z", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Mais curtidas", exact: true }).click();
  await expect(page).toHaveURL(/cohort=900001&sort=likes$/);
  await expect.poll(links).toEqual(liked);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  mkdirSync("tmp/community-sort-review", { recursive: true });
  await page.screenshot({ path: `tmp/community-sort-review/${info.project.name}.png` });
});
