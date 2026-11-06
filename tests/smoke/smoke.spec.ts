import { test, expect, type Page } from "@playwright/test";
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

test("student signs in, recovers a lost publish response, edits and deletes one publication", async ({ page, request }) => {
  await page.goto("/entrar");
  await page.getByRole("button", { name: "Entrar com email" }).click();
  await expect(page.getByText("Informe seu email.", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations.filter(issue => ["serious", "critical"].includes(issue.impact || ""))).toEqual([]);
  await login(page);
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
  const publicResponse = await request.get("/api/projects");
  expect((await publicResponse.json()).filter((project: { title: string }) => project.title === title)).toHaveLength(1);
  await page.getByRole("link", { name: "Editar projeto", exact: true }).click();
  await page.locator("#project-title").fill(`${title} editada`);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(publishedURL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} editada`);
  await page.goto("/meus-projetos");
  await page.getByRole("button", { name: `Excluir ${title} editada`, exact: true }).click();
  await page.getByRole("button", { name: "Sim, excluir", exact: true }).click();
  await expect(page.getByRole("button", { name: `Excluir ${title} editada`, exact: true })).toHaveCount(0);
  const remaining = await (await request.get("/api/projects")).json();
  expect(remaining.some((project: { slug: string }) => project.slug === new URL(publishedURL).pathname.split("/").pop())).toBe(false);
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
