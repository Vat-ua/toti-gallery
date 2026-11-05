import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createProject, updateProject, deleteProject, leaveProject, type ProjectFormValues } from "../src/lib/projects-client";
import { FormValidationError } from "../src/lib/form-validation";

const fetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetch; });
const values: ProjectFormValues = { title: "Projeto", description: "Descrição suficiente para um projeto de teste.", technologies: ["React"], isFinal: true, turmaId: "turma", coauthorIds: ["coauthor"], coverStyle: "books", imageUrl: "", coverFraming: { x: 25, y: 60, zoom: 1.3 }, githubUrl: "https://github.com/example/project", liveUrl: "" };

test("create/update serialize all editor values and the optional file without a JSON content-type", async () => {
  const image = new File(["fixture"], "cover.png", { type: "image/png" });
  const calls: { path: string; method: string; body: FormData }[] = [];
  globalThis.fetch = async (path, init) => {
    assert.equal(init?.headers, undefined); assert(init?.body instanceof FormData);
    const body = init.body;
    assert.deepEqual(JSON.parse(String(body.get("data"))), values);
    calls.push({ path: String(path), method: init.method!, body });
    return Response.json(init.method === "POST" ? { id: "id", slug: "slug" } : { ok: true, slug: "slug" });
  };
  assert.deepEqual(await createProject(values, image), { id: "id", slug: "slug" });
  assert.deepEqual(await updateProject("id", values), { ok: true, slug: "slug" });
  assert.deepEqual(calls.map(({ path, method }) => [path, method]), [["/api/projects", "POST"], ["/api/projects/id", "PATCH"]]);
  assert.equal(calls[0].body.get("image"), image); assert.equal(calls[1].body.has("image"), false);
});
test("delete and leave use distinct endpoints without a request body", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (path, init) => { assert.equal(init?.method, "DELETE"); assert.equal(init.body, undefined); calls.push(String(path)); return Response.json({ ok: true, slug: "slug" }); };
  assert.deepEqual(await deleteProject("id"), { ok: true, slug: "slug" });
  assert.deepEqual(await leaveProject("id"), { ok: true });
  assert.deepEqual(calls, ["/api/projects/id", "/api/projects/id/authors/me"]);
});
test("all operations preserve structured server errors and authentication failures", async () => {
  const operations = [() => createProject(values), () => updateProject("id", values), () => deleteProject("id"), () => leaveProject("id")];
  globalThis.fetch = async () => Response.json({ error: "Confira o título", fieldErrors: { title: "Título inválido" } }, { status: 400 });
  for (const operation of operations) await assert.rejects(operation, error => error instanceof FormValidationError && error.fieldErrors.title === "Título inválido");
  globalThis.fetch = async () => Response.json({ error: "Entre novamente." }, { status: 401 });
  for (const operation of operations) await assert.rejects(operation, /Entre novamente/);
});
test("network, non-JSON and malformed success responses produce usable failures", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(() => createProject(values), /Confira sua conexão/);
  for (const status of [200, 502]) {
    globalThis.fetch = async () => new Response("<html>Proxy error</html>", { status });
    await assert.rejects(() => updateProject("id", values), /Não foi possível salvar seu projeto/);
  }
  for (const body of [{}, null, [], { ok: false, slug: "slug" }, { ok: true, slug: 3 }]) {
    globalThis.fetch = async () => Response.json(body);
    await assert.rejects(() => deleteProject("id"), /Não foi possível excluir/);
  }
});
