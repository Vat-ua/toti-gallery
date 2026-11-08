import { test, expect, type Page } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "./setup";

async function login(page: Page, admin = false) {
  const data = fixture();
  await page.goto("/entrar");
  await page.getByLabel("Email", { exact: true }).fill(admin ? data.adminEmail : data.email);
  await page.getByLabel("Senha", { exact: true }).fill(data.password);
  await page.getByRole("button", { name: "Entrar com email" }).click();
  await expect(page).toHaveURL(/\/meus-projetos$/);
}

test("publication links go directly to login for guests and follow fresh sign-in/out state", async ({ page }, info) => {
  const loginHref = "/entrar?next=%2Fmeus-projetos%2Fnovo";
  await page.goto("/");
  const links = page.locator('.hero-publish, .publish-band a, .site-footer a').filter({ hasText: /Publicar projeto/ });
  await expect(page.locator(".header-publish")).toHaveAttribute("href", loginHref);
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) await expect(link).toHaveAttribute("href", loginHref);
  if (info.project.name === "mobile") {
    await page.locator(".mobile-menu-button").click();
    await expect(page.locator(".mobile-publish")).toHaveAttribute("href", loginHref);
    await page.locator(".mobile-menu-button").click();
  }
  const editorRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname === "/meus-projetos/novo") editorRequests.push(request.url()); });
  await page.locator(".hero-publish").click();
  await expect(page.locator(".auth-form-section")).toBeVisible();
  await expect(page).toHaveURL(/\/entrar\?next=/);
  expect(editorRequests).toEqual([]);
  const data = fixture();
  await page.getByLabel("Email", { exact: true }).fill(data.email);
  await page.getByLabel("Senha", { exact: true }).fill(data.password);
  await page.getByRole("button", { name: "Entrar com email", exact: true }).click();
  await expect(page).toHaveURL(/\/meus-projetos\/novo$/);
  await page.goto("/");
  await expect(page.locator(".hero-publish")).toHaveAttribute("href", "/meus-projetos/novo");
  await expect(page.locator(".header-publish")).toHaveAttribute("href", "/meus-projetos/novo");
  await page.getByRole("button", { name: "Abrir menu da conta", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sair da conta", exact: true }).click();
  await expect(page.locator(".hero-publish")).toHaveAttribute("href", loginHref);
  await expect(page.locator(".header-publish")).toHaveAttribute("href", loginHref);
});

test("visitor can explore, filter, like and open a project; private pages require login", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Projetos de quem");
  await page.getByRole("button", { name: "Projetos finais", exact: true }).click();
  await expect(page).toHaveURL(/final=1/);
  await page.getByRole("textbox", { name: "Buscar projetos" }).fill("Projeto smoke inicial");
  const card = page.locator(".project-card").filter({ has: page.locator('a[href="/projetos/smoke-project"]') });
  await expect(card).toHaveCount(1);
  const like = card.getByRole("button", { name: /curtir projeto/i });
  await like.click(); await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAttribute("aria-busy", "false");
  await card.locator('a[href="/projetos/smoke-project"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Projeto smoke inicial");
  await page.goto("/comunidade");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comunidade");
  await page.locator(".person-card").filter({ hasText: "Estudante smoke" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Estudante smoke");
  await page.goto("/meus-projetos"); await expect(page).toHaveURL(/\/entrar\?next=/);
});

test("sitemap returns public XML with unique profile URLs and excludes service pages", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("xml");
  expect(response.headers()["cache-control"]).toContain("max-age=0");
  expect(response.headers()["cache-control"]).toContain("must-revalidate");
  const body = await response.text();
  const urls = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g), match => match[1]);
  const origin = new URL(response.url()).origin;
  for (const path of ["/", "/comunidade", "/sobre", "/projetos/smoke-project"]) expect(urls).toContain(origin + path);
  expect(new Set(urls).size).toBe(urls.length);
  expect(urls.filter(url => new URL(url).pathname.startsWith("/pessoas/"))).toHaveLength(1);
  for (const url of urls) {
    expect(new URL(url).origin).toBe(origin);
    expect(new URL(url).search).toBe("");
    expect(new URL(url).pathname).not.toMatch(/^\/(admin|api|demo|apresentacao|acesso|entrar|minha-conta|meus-projetos)(\/|$)/);
  }
});

test("public canonical URLs and robots agree; service pages stay out of the index", async ({ page, request, baseURL }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  const rules = await robots.text();
  expect(rules).toContain("User-Agent: *");
  expect(rules).toContain("Allow: /");
  expect(rules).toContain("Disallow: /api/");
  expect(rules).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  expect(rules).not.toMatch(/Disallow: \/(demo|entrar|acesso|apresentacao|admin|meus-projetos|minha-conta)/);
  const xml = await (await request.get("/sitemap.xml")).text();
  const profile = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), match => new URL(match[1]).pathname)
    .find(path => path.startsWith("/pessoas/"));
  expect(profile).toBeTruthy();
  for (const [path, canonical] of [
    ["/?q=smoke&sort=az&page=2", "/"],
    ["/comunidade?q=smoke", "/comunidade"],
    ["/sobre", "/sobre"],
    ["/projetos/smoke-project", "/projetos/smoke-project"],
    [profile!, profile!],
  ]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    // Next.js serializes the root canonical without a trailing slash.
    const expectedURL = canonical === "/" ? new URL(baseURL!).origin : new URL(canonical, baseURL).href;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", expectedURL);
  }
  for (const path of ["/entrar?next=%2Fmeus-projetos", "/acesso", "/demo", "/apresentacao"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  }
});

test("student signs in, recovers a lost publish response, edits and deletes one publication", async ({ page, request }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Entrar com email" }).click();
  await expect(page.getByText("Informe seu email.", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations.filter(issue => ["serious", "critical"].includes(issue.impact || ""))).toEqual([]);
  await login(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  expect((await page.request.post("/api/admin/turmas", { headers: { origin: new URL(page.url()).origin }, data: {} })).status()).toBe(403);
  await page.locator("main").getByRole("link", { name: "Publicar projeto", exact: true }).click();
  const title = `Publicação smoke ${test.info().project.name}`;
  await page.locator("#project-title").fill(title);
  await page.locator("#project-description").fill("Uma descrição sintética suficientemente detalhada para verificar publicação e edição.");
  await page.getByRole("button", { name: "React", exact: true }).click();
  await page.getByLabel("Repositório no GitHub", { exact: false }).fill("https://github.com/example/smoke");
  let lost = false;
  await page.route("**/api/projects", async route => {
    if (!lost && route.request().method() === "POST") { lost = true; await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Publicar projeto", exact: true }).click();
  await expect(page.locator(".form-error")).toContainText("conexão");
  await expect(page.locator("#project-title")).toHaveValue(title);
  await page.getByRole("button", { name: "Publicar projeto", exact: true }).click();
  await expect(page).toHaveURL(/\/projetos\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const publishedURL = page.url();
  expect(await (await request.get("/sitemap.xml")).text()).toContain(`<loc>${publishedURL}</loc>`);
  const publicResponse = await request.get(`/api/projects?q=${encodeURIComponent(title)}`);
  expect((await publicResponse.json()).items.filter((project: { title: string }) => project.title === title)).toHaveLength(1);
  await page.getByRole("link", { name: "Editar projeto", exact: true }).click();
  await page.locator("#project-title").fill(`${title} editada`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(publishedURL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} editada`);
  await page.goto("/meus-projetos");
  await page.getByRole("button", { name: `Excluir ${title} editada`, exact: true }).click();
  await page.getByRole("button", { name: "Sim, excluir", exact: true }).click();
  await expect(page.getByRole("button", { name: `Excluir ${title} editada`, exact: true })).toHaveCount(0);
  const remaining = await (await request.get(`/api/projects?q=${encodeURIComponent(title)}`)).json();
  expect(remaining.items.some((project: { slug: string }) => project.slug === new URL(publishedURL).pathname.split("/").pop())).toBe(false);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(`<loc>${publishedURL}</loc>`);
  // A streamed Next.js not-found response can legitimately retain HTTP 200.
  await page.goto(publishedURL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Essa ideia tomou outro caminho.");
});

test("administrator can open Turmas, Estudantes and Projetos; owner-only access remains restricted", async ({ page }) => {
  await login(page, true);
  for (const [path, title] of [["turmas", "Turmas"], ["estudantes", "Estudantes"], ["projetos", "Projetos"]]) {
    await page.goto(`/admin/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator(".admin-role")).toHaveText("Administrador");
  }
  expect((await page.request.get("/api/admin/administradores")).status()).toBe(403);
  await page.goto("/admin/estudantes");
  await page.getByRole("row").filter({ hasText: "Estudante smoke" }).getByRole("button", { name: /Gerenciar/ }).click();
  const panel = page.getByRole("dialog");
  await panel.getByLabel("Nome", { exact: true }).fill("Estudante smoke atualizado");
  await panel.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(panel.locator(".toast")).toHaveText(/Dados do estudante atualizados\./);
  // A click proves the toast is above the native backdrop and is not inert.
  await panel.getByRole("button", { name: "Fechar aviso", exact: true }).click();
  await expect(panel.locator(".toast")).toHaveCount(0);
  await expect(panel).toBeVisible();
  await panel.getByLabel("Nome", { exact: true }).fill("Estudante smoke");
  await panel.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(panel.locator(".toast")).toContainText("Dados do estudante atualizados.");
  await panel.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".toast-region")).toHaveCount(1);
  await expect(page.locator(".toast")).toContainText("Dados do estudante atualizados.");
});
