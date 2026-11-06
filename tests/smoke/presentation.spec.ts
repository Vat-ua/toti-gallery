import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("presentation supports keyboard tabs, screenshot viewing and the data model without API writes", async ({ page }, info) => {
  test.setTimeout(120_000);
  const calls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => { calls.push(route.request().method()); await route.abort(); });
  await page.goto("/apresentacao");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Do exercício ao projeto final.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const tabs = page.getByRole("tablist", { name: "Seções da apresentação" });
  await expect(tabs.getByRole("tab")).toHaveCount(4);
  await expect(tabs.getByRole("tab", { name: "O projeto", exact: true })).toHaveAttribute("aria-selected", "true");
  const screenshot = page.getByRole("tabpanel").getByRole("button", { name: /^Ampliar imagem/ });
  await expect(page.getByRole("tabpanel").locator("img")).toHaveJSProperty("complete", true);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("presentation-overview.png"), fullPage: true });
  await screenshot.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar imagem", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(screenshot).toBeFocused();

  await tabs.getByRole("tab", { name: "O projeto", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#pratica$/);
  await expect(tabs.getByRole("tab", { name: "Na prática", exact: true })).toBeFocused();
  await page.getByRole("button", { name: /Reconheça toda a equipe/ }).click();
  await expect(page.getByRole("tabpanel").getByRole("img")).toHaveAttribute("alt", /seis autores/);
  await page.getByRole("button", { name: /Compartilhe o resultado/ }).click();
  await expect(page.getByRole("tabpanel").getByRole("img")).toHaveAttribute("alt", /Alex Oliveira/);

  await tabs.getByRole("tab", { name: "Administração", exact: true }).click();
  for (const name of ["Turmas", "Estudantes", "Projetos", "Administradores"]) {
    const button = page.getByRole("tabpanel").getByRole("button", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("tabpanel").locator("img")).toHaveJSProperty("complete", true);
    await expect(page.getByRole("tabpanel").locator("img")).not.toHaveJSProperty("naturalWidth", 0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("presentation-admin.png"), fullPage: true });

  await tabs.getByRole("tab", { name: "Tecnologia", exact: true }).click();
  await expect(page.locator(".presentation-graph path")).toHaveCount(7);
  await page.locator('[data-entity="likes"]').click();
  await expect(page.locator('[data-entity="likes"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".presentation-inspector h4")).toHaveText("Curtidas");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("presentation-technology.png"), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations.filter(issue => ["serious", "critical"].includes(issue.impact || ""))).toEqual([]);
  expect(await page.locator("body").evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await expect(tabs.getByRole("tab", { name: "Tecnologia", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});
