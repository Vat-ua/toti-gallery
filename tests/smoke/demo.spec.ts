import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fixture } from "./setup";

function prohibitAPI(page: Page) {
  const calls: string[] = [];
  page.route("**/api/**", async route => { calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`); await route.abort(); });
  return calls;
}
async function openDemo(page: Page) {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meus projetos");
  await expect(page.locator(".management-card")).toHaveCount(2);
  await expect(page.locator(".site-header")).toHaveCount(1);
  await expect(page.locator(".site-footer")).toHaveCount(1);
  await expect(page.locator(".site-footer").getByRole("link", { name: /demonstração/i })).toHaveCount(0);
}
async function imageFrame(page: Page) {
  return page.locator(".custom-cover-image").evaluate(image => {
    const style = (image as HTMLImageElement).style;
    const [x, y] = style.objectPosition.split(" ").map(value => parseFloat(value));
    return { x, y, transform: style.transform };
  });
}
async function expectFrame(page: Page, before: Awaited<ReturnType<typeof imageFrame>>) {
  const saved = await imageFrame(page);
  // Shared validation intentionally normalizes percentages to three decimals.
  expect(saved.x).toBeCloseTo(before.x, 2);
  expect(saved.y).toBeCloseTo(before.y, 2);
  expect(saved.transform).toBe(before.transform);
}

test("demo seeds illustrate the profile and supported Markdown without API", async ({ page }) => {
  const calls = prohibitAPI(page);
  await page.goto("/demo/perfil");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alex Oliveira");
  await expect(page.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/");
  await expect(page.getByRole("link", { name: "LinkedIn", exact: true })).toHaveAttribute("href", "https://www.linkedin.com/");
  await page.goto("/demo/projetos/meu-portfolio");
  await expect(page.getByRole("heading", { name: "O que pratiquei", level: 3 })).toBeVisible();
  await page.goto("/demo/projetos/lista-de-tarefas");
  await expect(page.getByRole("heading", { name: "Funcionalidades", level: 3 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bloco de código" })).toContainText("function contarPendentes(tarefas)");
  await expect(page.locator(".project-markdown blockquote")).toContainText("Uma lista pequena, com ações claras e uma tarefa de cada vez.");
  expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  expect(calls).toEqual([]);
});

test("local demo persists images and framing, supports CRUD, profile, empty state and reset without API", async ({ page }, info) => {
  test.setTimeout(90_000);
  const calls = prohibitAPI(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openDemo(page);
  await expect(page.getByText("Modo de demonstração", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Curtir projeto/i })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Administração");
  expect(await page.locator(".demo-banner").evaluate(el => el.clientHeight)).toBeLessThan(80);
  await page.getByRole("button", { name: "Abrir menu da conta", exact: true }).click();
  await page.getByRole("menuitem", { name: "Meu perfil", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alex Oliveira");
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page.goto("/demo/novo");
  await page.locator("#project-title").fill("Meu jardim de ideias");
  await page.locator("#project-description").fill("Um projeto de estudo com **Markdown**, imagens e um registro das plantas do meu jardim.");
  await page.getByRole("button", { name: "React", exact: true }).click();
  await page.getByLabel("Repositório no GitHub", { exact: false }).fill("https://github.com/example/jardim");
  await page.locator("#project-cover-file").setInputFiles({ name: "plant.jpg", mimeType: "image/jpeg", buffer: readFileSync("public/images/plant.jpg") });
  await page.getByRole("button", { name: "Ajustar enquadramento" }).click();
  await page.getByRole("slider", { name: "Zoom" }).fill("1.35");
  await page.getByRole("button", { name: "Mover imagem da capa" }).press("ArrowUp");
  await page.getByRole("button", { name: "Mover imagem da capa" }).press("ArrowRight");
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  const frame = await imageFrame(page);
  expect(frame.x).toBeLessThan(50);
  expect(frame.y).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Publicar projeto", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/projetos\//);
  const url = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meu jardim de ideias");
  await expectFrame(page, frame);
  await page.reload();
  await expect(page.locator(".custom-cover-image")).toBeVisible();
  await expectFrame(page, frame);
  await expect.poll(() => page.locator(".custom-cover-image").evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await page.getByRole("link", { name: "Editar projeto", exact: true }).click();
  await page.locator("#project-title").fill("Jardim editado");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jardim editado");
  await expectFrame(page, frame);
  await page.goto("/demo");
  await expect(page.locator(".management-card")).toHaveCount(3);
  await page.screenshot({ path: info.outputPath("demo-projects.png"), fullPage: true });
  await page.getByRole("button", { name: "Excluir Jardim editado", exact: true }).click();
  await page.getByRole("button", { name: "Sim, excluir", exact: true }).click();
  await expect(page.locator(".management-card")).toHaveCount(2);
  for (const title of ["Meu portfólio", "Lista de tarefas"]) {
    await page.getByRole("button", { name: `Excluir ${title}`, exact: true }).click();
    await page.getByRole("button", { name: "Sim, excluir", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Você ainda não tem projetos." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Você ainda não tem projetos." })).toBeVisible();
  await page.getByRole("button", { name: "Restaurar dados", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Todos os projetos que você criou, as imagens enviadas e as alterações");
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator(".management-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Restaurar dados", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restaurar dados", exact: true }).click();
  await expect(page.locator(".management-card")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".management-card")).toHaveCount(2);
  expect(await page.locator("body").evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test("authenticated visitors cannot enter demo or activate it with its presentation cookie", async ({ page }) => {
  const data = fixture();
  await page.goto("/entrar");
  await page.getByLabel("Email", { exact: true }).fill(data.adminEmail);
  await page.getByLabel("Senha", { exact: true }).fill(data.password);
  await page.getByRole("button", { name: "Entrar com email" }).click();
  await expect(page).toHaveURL(/\/meus-projetos$/);
  const session = (await page.context().cookies()).filter(cookie => cookie.name.includes("session_token"));
  expect(session.length).toBeGreaterThan(0);
  await expect(page.locator(".site-footer").getByRole("link", { name: "Demonstração", exact: true })).toHaveCount(0);
  await page.context().addCookies([{ name: "toti_demo", value: "1", url: new URL(page.url()).origin }]);
  for (const path of ["/demo", "/demo/novo", "/demo/perfil", "/demo/projetos/meu-portfolio/editar"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/meus-projetos$/);
    await expect(page.locator(".demo-banner")).toHaveCount(0);
    await expect(page.locator(".management-card")).toHaveCount(0);
  }
  expect((await page.context().cookies()).filter(cookie => cookie.name.includes("session_token"))).toEqual(session);
  expect(await page.evaluate(async () => (await indexedDB.databases()).some(db => db.name === "toti-gallery-demo"))).toBe(false);
});

test("demo keeps normal public navigation and browser likes, then exits without erasing local projects", async ({ page }, info) => {
  test.setTimeout(90_000);
  const mutations: string[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/visitor" || /^\/api\/projects\/[^/]+\/like$/.test(path)) await route.continue();
    else { mutations.push(path); await route.abort(); }
  });
  await openDemo(page);
  const navigate = async (name: string) => {
    if (info.project.name === "mobile") {
      await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
      await page.locator(".mobile-nav").getByRole("link", { name, exact: true }).click();
    } else await page.locator(".desktop-nav").getByRole("link", { name, exact: true }).click();
  };
  await navigate("Explorar");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Projetos de quem");
  await expect(page.locator(".demo-banner")).toBeVisible();
  await expect(page.locator(".project-card")).toHaveCount(1);
  const like = page.locator(".project-card").getByRole("button", { name: /curtir projeto/i });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAttribute("aria-busy", "false");
  // Public likes retain their normal browser identity, including after reload.
  await page.reload();
  await expect(page.locator(".demo-banner")).toBeVisible();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(like).toHaveAttribute("aria-busy", "false");
  await navigate("Comunidade");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comunidade");
  await expect(page.locator(".demo-banner")).toBeVisible();
  await page.locator(".person-card").first().click();
  await expect(page.locator(".demo-banner")).toBeVisible();
  await expect(page.locator(".header-publish")).toHaveAttribute("href", "/demo/novo");
  await navigate("Meus projetos");
  await expect(page.locator(".management-card")).toHaveCount(2);
  // The presentation marker grants no permissions to the real project API.
  expect((await page.request.post("/api/projects", { headers: { origin: new URL(page.url()).origin }, data: {} })).status()).toBe(401);
  await page.getByRole("button", { name: "Abrir menu da conta", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sair da demonstração", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Entrar", exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Entrar", exact: true }).first().click();
  await page.getByRole("link", { name: "Experimentar sem cadastro", exact: true }).click();
  await expect(page.locator(".management-card")).toHaveCount(2);
  expect(mutations).toEqual([]);
});

test("blocked local storage shows recovery instead of a fake empty account or API fallback", async ({ page }) => {
  const calls = prohibitAPI(page);
  await page.addInitScript(() => { Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Blocked", "SecurityError"); } }); });
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Demonstração indisponível" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(page.locator(".management-card")).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("a failed IndexedDB write preserves the form and previously saved projects", async ({ page }) => {
  const calls = prohibitAPI(page);
  await openDemo(page);
  await page.goto("/demo/projetos/meu-portfolio/editar");
  await page.locator("#project-title").fill("Alteração ainda não salva");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException("Full", "QuotaExceededError"); };
  });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".form-error")).toContainText("armazenamento");
  await expect(page.locator("#project-title")).toHaveValue("Alteração ainda não salva");
  page.on("dialog", dialog => dialog.accept());
  await page.reload();
  await expect(page.locator("#project-title")).toHaveValue("Meu portfólio");
  expect(calls).toEqual([]);
});
