import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { administratorsApi, moderateProject, studentsApi, turmasApi } from "../src/lib/admin-client";
import { HttpError } from "../src/lib/http-client";
import { FormValidationError } from "../src/lib/form-validation";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const person = { id: "fixture-user", name: "Pessoa", email: "pessoa@example.invalid", status: "pending", isDemo: false };
const grant = { url: "https://example.invalid/acesso#token=fixture", expiresAt: "2030-01-01T12:00:00.000Z" };
const snapshot = { turmaIds: ["group"], primaryTurmaId: null };
const imported = { preview: [{ line: 1, name: person.name, email: person.email, kind: "new" }], created: 0, linked: 0, unchanged: 0 };
test("typed operations preserve endpoint, method and request fields for every admin scenario", async () => {
  const cases: { run: () => Promise<unknown>; path: string; method?: string; body?: unknown; response: unknown }[] = [
    { run: () => turmasApi.save(undefined, { number: 58, courseName: "Full Stack", startYear: 2026 }), path: "/api/admin/turmas", body: { number: 58, courseName: "Full Stack", startYear: 2026 }, response: { id: "group" } },
    { run: () => turmasApi.save("group", { number: 58, courseName: "Full Stack", startYear: 2026 }), path: "/api/admin/turmas/group", method: "PATCH", body: { action: "save", number: 58, courseName: "Full Stack", startYear: 2026 }, response: { id: "group" } },
    { run: () => turmasApi.archive("group", true), path: "/api/admin/turmas/group", method: "PATCH", body: { action: "archive", archived: true }, response: { ok: true } },
    { run: () => turmasApi.lookup("group", person.email), path: "/api/admin/turmas/group/members", body: { action: "lookup", email: person.email }, response: { student: { ...person, member: false, blocked: false, reason: null } } },
    { run: () => turmasApi.candidates("group", "Pessoa"), path: "/api/admin/turmas/group/members", body: { action: "candidates", query: "Pessoa" }, response: { candidates: [person] } },
    { run: () => turmasApi.add("group", person.name, person.email), path: "/api/admin/turmas/group/members", body: { action: "add", name: person.name, email: person.email }, response: { ...person, created: true } },
    { run: () => turmasApi.membership("group", person.id, false), path: "/api/admin/turmas/group/members", method: "DELETE", body: { userId: person.id }, response: { ok: true } },
    { run: () => turmasApi.access("group", person.id, "activation"), path: "/api/admin/turmas/group/access", body: { userId: person.id, purpose: "activation" }, response: grant },
    { run: () => turmasApi.import("group", "CSV", "confirm", [2]), path: "/api/admin/turmas/group/import", body: { action: "confirm", text: "CSV", excluded: [2] }, response: imported },
    { run: () => studentsApi.profile(person.id, person.name, person.email), path: `/api/admin/estudantes/${person.id}`, body: { action: "profile", name: person.name, email: person.email }, response: { name: person.name, email: person.email, emailChanged: false } },
    { run: () => studentsApi.memberships(person.id, snapshot, snapshot), path: `/api/admin/estudantes/${person.id}`, body: { action: "turmas", ...snapshot, expected: snapshot }, response: snapshot },
    { run: () => studentsApi.suspend(person.id, true), path: `/api/admin/estudantes/${person.id}`, body: { action: "suspend", suspended: true }, response: { status: "suspended" } },
    { run: () => studentsApi.access(person.id, "password_reset"), path: `/api/admin/estudantes/${person.id}`, body: { action: "access", purpose: "password_reset" }, response: grant },
    { run: () => studentsApi.revoke(person.id, "grant"), path: `/api/admin/estudantes/${person.id}`, body: { action: "revoke-link", grantId: "grant" }, response: { ok: true } },
    { run: () => studentsApi.remove(person.id), path: `/api/admin/estudantes/${person.id}`, body: { action: "delete" }, response: { id: person.id } },
    { run: () => administratorsApi.candidates("Pessoa"), path: "/api/admin/administradores?q=Pessoa", method: "GET", response: { candidates: [person] } },
    { run: () => administratorsApi.create(person.name, person.email), path: "/api/admin/administradores", body: { action: "create", name: person.name, email: person.email }, response: { ...person, grant } },
    { run: () => administratorsApi.promote(person.id), path: "/api/admin/administradores", body: { action: "promote", userId: person.id }, response: { ...person, grant: null } },
    { run: () => administratorsApi.access(person.id, "activation"), path: `/api/admin/administradores/${person.id}`, body: { action: "access", purpose: "activation" }, response: grant },
    { run: () => administratorsApi.revoke(person.id, "grant"), path: `/api/admin/administradores/${person.id}`, body: { action: "revoke-link", grantId: "grant" }, response: { id: "grant" } },
    { run: () => administratorsApi.remove(person.id), path: `/api/admin/administradores/${person.id}`, body: { action: "remove" }, response: { id: person.id } },
    { run: () => moderateProject("project", "published", "Reason"), path: "/api/admin/projetos/project", body: { action: "hide", expectedVisibility: "published", reason: "Reason" }, response: { id: "project", visibility: "hidden" } },
  ];
  for (const item of cases) {
    globalThis.fetch = async (path, init) => {
      assert.equal(path, item.path); assert.equal(init?.method, item.method || "POST");
      assert.deepEqual(init?.body ? JSON.parse(String(init.body)) : undefined, item.body);
      return Response.json(item.response);
    };
    await item.run();
    globalThis.fetch = async () => Response.json({});
    await assert.rejects(item.run, /Não foi possível concluir/);
  }
});
test("lookup null is valid; malformed success shapes are rejected before reaching UI state", async () => {
  globalThis.fetch = async () => Response.json({ student: null }); assert.equal(await turmasApi.lookup("group", person.email), null);
  for (const data of [{ candidates: [{}] }, { candidates: [{ ...person, status: "invalid" }] }, { candidates: null }]) {
    globalThis.fetch = async () => Response.json(data); await assert.rejects(() => turmasApi.candidates("group", "Pessoa"));
  }
  for (const data of [{ ...grant, expiresAt: "invalid" }, { ...grant, url: "javascript:alert(1)" }]) {
    globalThis.fetch = async () => Response.json(data); await assert.rejects(() => studentsApi.access(person.id, "activation"));
  }
  globalThis.fetch = async () => Response.json({ turmaIds: ["group"], primaryTurmaId: "other" });
  await assert.rejects(() => studentsApi.memberships(person.id, snapshot, snapshot));
  globalThis.fetch = async () => Response.json({ ...imported, created: -1 }); await assert.rejects(() => turmasApi.import("group", "CSV", "preview"));
  globalThis.fetch = async () => Response.json({ ...imported, preview: [{ ...imported.preview[0], kind: ["new"] }] });
  await assert.rejects(() => turmasApi.import("group", "CSV", "preview"));
});
test("HTTP statuses, field errors, network failures and non-JSON errors remain usable", async () => {
  globalThis.fetch = async () => Response.json({ fieldErrors: { email: "Confira o email" } }, { status: 400 });
  await assert.rejects(() => studentsApi.profile(person.id, person.name, person.email), error => error instanceof FormValidationError && error.fieldErrors.email === "Confira o email");
  for (const status of [401, 403, 409]) {
    globalThis.fetch = async () => Response.json({ error: "Atualize a página." }, { status });
    await assert.rejects(() => studentsApi.memberships(person.id, snapshot, snapshot), error => error instanceof HttpError && error.status === status);
  }
  for (const status of [200, 502]) {
    globalThis.fetch = async () => new Response("<html>Upstream</html>", { status });
    await assert.rejects(() => studentsApi.remove(person.id), /Não foi possível concluir/);
  }
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(() => studentsApi.remove(person.id), /Confira sua conexão/);
});
test("search forwards AbortSignal and preserves cancellation", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_path, init) => {
    assert.equal(init?.signal, controller.signal); controller.abort(); throw new DOMException("Aborted", "AbortError");
  };
  await assert.rejects(() => administratorsApi.candidates("Pessoa", controller.signal), error => error instanceof DOMException && error.name === "AbortError");
});
