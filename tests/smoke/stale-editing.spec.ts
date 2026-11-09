import { test, expect, type Page } from "./fixtures";
import { fixture } from "./setup";
import type { ProfileSnapshot } from "../../src/lib/account";

async function signIn(page: Page, admin = false) {
  const data = fixture();
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://127.0.0.1:3102" },
    data: { email: admin ? data.adminEmail : data.email, password: data.password },
  });
  expect(response.status()).toBe(200);
}

function snapshot(user: ProfileSnapshot): ProfileSnapshot {
  return { name: user.name, bio: user.bio, github: user.github, linkedin: user.linkedin, avatar: user.avatar };
}

async function openProfile(page: Page) {
  await page.bringToFront();
  await page.goto("/minha-conta");
  // Check a real React interaction before filling controlled inputs. SSR markup
  // alone does not establish that hydration has finished on a slower machine.
  await page.getByRole("button", { name: "Mostrar senha atual", exact: true }).click();
  await expect(page.locator("#currentPassword")).toHaveAttribute("type", "text");
}

test("profile tabs retain unsaved input on conflicts and advance their own snapshot after success", async ({ page }) => {
  await signIn(page);
  await openProfile(page);
  // The synthetic smoke account starts without a photo; this test never changes it.
  const original = {
    name: await page.locator("#account-name").inputValue(), bio: await page.locator("#account-bio").inputValue(),
    github: await page.locator("#account-github").inputValue() || null,
    linkedin: await page.locator("#account-linkedin").inputValue() || null, avatar: null,
  };
  let current: ProfileSnapshot = original;
  const second = await page.context().newPage();
  const lastBio = `Second accepted biography ${test.info().project.name}`;
  try {
    await openProfile(second);
    await second.locator("#account-bio").fill("Biography retained in the stale tab");
    await expect(second.locator("#account-bio")).toHaveValue("Biography retained in the stale tab");
    await page.bringToFront();
    for (const bio of [`First accepted biography ${test.info().project.name}`, lastBio]) {
      await page.locator("#account-bio").fill(bio);
      const saved = page.waitForResponse(response => new URL(response.url()).pathname === "/api/account" && response.request().method() === "PATCH");
      await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
      const response = await saved;
      expect(response.status()).toBe(200);
      current = snapshot((await response.json()).user);
      await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
    }
    await second.bringToFront();
    const rejected = second.waitForResponse(response => new URL(response.url()).pathname === "/api/account");
    await second.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    expect((await rejected).status()).toBe(409);
    await expect(second.locator(".form-error")).toContainText("perfil foi alterado");
    await expect(second.locator("#account-bio")).toHaveValue("Biography retained in the stale tab");
    await page.bringToFront();
    await page.reload();
    await expect(page.locator("#account-bio")).toHaveValue(lastBio);
  } finally {
    const response = await page.request.patch("/api/account", { headers: { origin: "http://127.0.0.1:3102" }, data: { ...original, expected: current } });
    expect(response.status()).toBe(200);
    await second.close();
  }
});

test("administrative profile and turma forms retain input and reject stale originals after refresh", async ({ page }) => {
  await signIn(page, true);
  const data = fixture(), headers = { origin: "http://127.0.0.1:3102" };
  await page.goto("/admin/estudantes");
  await page.getByRole("button", { name: "Gerenciar Estudante smoke", exact: true }).click();
  let dialog = page.getByRole("dialog");
  const original = { name: await dialog.locator("#student-name").inputValue(), email: await dialog.locator("#student-email").inputValue() };
  const changed = { ...original, name: "Accepted administrative name" };
  try {
    await dialog.locator("#student-name").fill("Unsaved administrative name");
    expect((await page.request.post(`/api/admin/estudantes/${data.studentId}`, { headers, data: { action: "profile", ...changed, expected: original } })).status()).toBe(200);
    // Generating a link refreshes server props while keeping this drawer open.
    // Its draft and original snapshot must remain paired, even as its title updates.
    await dialog.getByRole("button", { name: /^Gerar.*link/ }).click();
    await expect(dialog.getByRole("heading", { name: changed.name, exact: true })).toBeVisible();
    const rejected = page.waitForResponse(response => new URL(response.url()).pathname === `/api/admin/estudantes/${data.studentId}` && response.request().postDataJSON()?.action === "profile");
    await dialog.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    expect((await rejected).status()).toBe(409);
    await expect(dialog.locator(".admin-student-profile [role=alert]")).toContainText("mudaram");
    await expect(dialog.locator("#student-name")).toHaveValue("Unsaved administrative name");
    await dialog.getByRole("button", { name: "Revogar link", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Revogar link", exact: true })).toHaveCount(0);
  } finally {
    expect((await page.request.post(`/api/admin/estudantes/${data.studentId}`, { headers, data: { action: "profile", ...original, expected: changed } })).status()).toBe(200);
  }

  await page.goto(`/admin/turmas/${data.turmaId}`);
  await page.getByRole("button", { name: "Editar turma", exact: true }).click();
  dialog = page.getByRole("dialog");
  const group = {
    number: Number(await dialog.locator("#turma-number").inputValue()),
    courseName: await dialog.locator("#turma-course").inputValue(), startYear: Number(await dialog.locator("#turma-year").inputValue()),
  };
  const updated = { ...group, courseName: "Accepted course" };
  try {
    await dialog.locator("#turma-course").fill("Unsaved course");
    expect((await page.request.patch(`/api/admin/turmas/${data.turmaId}`, { headers, data: { action: "save", ...updated, expected: group } })).status()).toBe(200);
    const rejected = page.waitForResponse(response => new URL(response.url()).pathname === `/api/admin/turmas/${data.turmaId}`);
    await dialog.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    expect((await rejected).status()).toBe(409);
    await expect(dialog.locator("[role=alert]")).toContainText("mudaram");
    await expect(dialog.locator("#turma-course")).toHaveValue("Unsaved course");
  } finally {
    expect((await page.request.patch(`/api/admin/turmas/${data.turmaId}`, { headers, data: { action: "save", ...group, expected: updated } })).status()).toBe(200);
  }
});
