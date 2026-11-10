import { Pool } from "pg";
import { test, expect } from "./fixtures";
import { fixture } from "./setup";
import { assertDatabaseTarget } from "../../src/lib/database-target.cjs";
import { DEMO_MODE_COOKIE } from "../../src/lib/demo-mode";

test("an isolated identity outage preserves public pages, closes private/demo access and supports retry", async ({ page }) => {
  if (process.env.GALLERY_LOCAL_TEST_DATABASE !== "1") throw new Error("This fault scenario requires the disposable local PostgreSQL service.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let renamed = false;
  try {
    await assertDatabaseTarget(pool, process.env, "test");
    const data = fixture(), origin = "http://127.0.0.1:3102";
    const response = await page.request.post("/api/auth/sign-in/email", {
      headers: { origin }, data: { email: data.adminEmail, password: data.password },
    });
    expect(response.status()).toBe(200);
    const projects = await (await page.request.get("/api/projects")).json();
    const profile = projects.items.find((item: { id: string }) => item.id === data.projectId).author.slug;
    expect((await page.request.get("/api/admin/projetos")).status()).toBe(200);

    // Only this suite's disposable DB is affected. Public content remains intact;
    // a valid session cookie now encounters a real SQL failure in session lookup.
    await pool.query("ALTER TABLE gallery_auth_sessions RENAME TO gallery_auth_sessions_unavailable");
    renamed = true;
    for (const path of ["/", "/comunidade", "/projetos/smoke-project", "/pessoas/" + profile, "/sobre"]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.getByRole("button", { name: "Conta indisponível. Tentar novamente", exact: true })).toBeVisible();
      await expect(page.locator(".site-footer")).toBeVisible();
      await expect(page.getByRole("link", { name: /^Editar (projeto|perfil)$/ })).toHaveCount(0);
      await expect(page.locator(".error-page")).toHaveCount(0);
    }
    await page.goto("/apresentacao#pratica");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("projeto final");
    await expect(page.getByRole("link", { name: "Acessar conta", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Experimentar demonstração", exact: true })).toHaveCount(0);

    const privateResponse = await page.request.get("/api/admin/projetos");
    expect([500, 503]).toContain(privateResponse.status());
    const failure = await privateResponse.json();
    expect(failure.items).toBeUndefined(); expect(failure.requestId).toBeTruthy();
    expect(JSON.stringify(failure)).not.toMatch(/select|gallery_auth_sessions|example\.invalid/i);
    await page.goto("/admin/turmas");
    await expect(page.locator(".error-page")).toBeVisible();
    await expect(page.locator(".admin-context")).toHaveCount(0);
    await page.goto("/demo");
    await expect(page.locator(".error-page")).toBeVisible();
    await expect(page.locator(".demo-banner")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Meus projetos", exact: true })).toHaveCount(0);

    // A stale demo cookie must not turn the same failed identity into guest/demo access.
    await page.context().addCookies([{ name: DEMO_MODE_COOKIE, value: "1", url: origin }]);
    await page.goto("/");
    await expect(page.locator(".hero")).toBeVisible();
    await expect(page.locator(".demo-banner")).toHaveCount(0);
    await expect(page.locator(".hero-publish")).toHaveAttribute("href", "/meus-projetos/novo");
    await pool.query("ALTER TABLE gallery_auth_sessions_unavailable RENAME TO gallery_auth_sessions");
    renamed = false;
    await page.getByRole("button", { name: "Conta indisponível. Tentar novamente", exact: true }).click();
    await expect(page.getByRole("button", { name: "Abrir menu da conta", exact: true })).toBeVisible();
    await expect(page.locator(".hero")).toBeVisible();
  } finally {
    try { if (renamed) await pool.query("ALTER TABLE gallery_auth_sessions_unavailable RENAME TO gallery_auth_sessions"); }
    finally { await pool.end(); }
  }
});
