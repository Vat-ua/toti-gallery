import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AdminError } from "../src/lib/admin-server";
import { FormValidationError } from "../src/lib/form-validation";
import { readLimitedBody } from "../src/lib/request-body";

const require = createRequire(`${process.cwd()}/package.json`);
const authPath = require.resolve("./src/lib/auth.ts");
const previous = require.cache[authPath];
let sameOrigin = true, actor: { id: string; role: string } | null = null;
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: { isSameOrigin: () => sameOrigin, getCurrentUser: async () => actor } } as NodeJS.Module;
const { adminMutation } = require("./src/lib/admin-http.ts") as typeof import("../src/lib/admin-http");
after(() => { if (previous) require.cache[authPath] = previous; else delete require.cache[authPath]; });
beforeEach(() => { sameOrigin = true; actor = { id: "fixture-staff", role: "admin" }; });
const request = (text = "{}") => new Request("https://example.invalid/api/admin/turmas", { method: "POST", body: text });

test("HTTP adapter checks origin and session before invoking an operation", async () => {
  let calls = 0; const operation = async () => { calls++; };
  sameOrigin = false; assert.equal((await adminMutation(request(), operation)).status, 403);
  sameOrigin = true; actor = null; assert.equal((await adminMutation(request(), operation)).status, 401);
  actor = { id: "student", role: "user" }; assert.equal((await adminMutation(request(), operation)).status, 403);
  assert.equal(calls, 0);
  actor = { id: "owner", role: "owner" };
  const result = await adminMutation(request('{"value":3}'), async (id, body) => { assert.equal(id, "owner"); assert.equal(body.value, 3); return { id: "result" }; });
  assert.equal(result.status, 200); assert.equal(result.headers.get("cache-control"), "no-store"); assert.deepEqual(await result.json(), { id: "result" });
});
test("malformed JSON, arrays and empty bodies never invoke a mutation", async () => {
  for (const text of ["", "{", "null", "[]", '"string"']) {
    const result = await adminMutation(request(text), async () => { assert.fail("must not run"); });
    assert.equal(result.status, 400); assert.equal(result.headers.get("cache-control"), "no-store");
  }
});
test("streamed byte limits cancel oversized bodies without executing a mutation", async () => {
  let canceled = false, pulls = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(100_000)); }, cancel() { canceled = true; } });
  const input = new Request("https://example.invalid/api/admin/turmas", { method: "POST", body: stream, duplex: "half", headers: { "content-length": "1" } } as RequestInit);
  const result = await adminMutation(input, async () => { assert.fail("must not run"); });
  assert.equal(result.status, 413); assert(canceled); assert(pulls <= 4);
  const declared = request("{}"); declared.headers.set("content-length", "250001");
  assert.equal((await adminMutation(declared, async () => { assert.fail("must not run"); })).status, 413);
  const bytes = new TextEncoder().encode('{"name":"João"}');
  assert.equal((await readLimitedBody(request('{"name":"João"}'), bytes.length)).toString(), '{"name":"João"}');
  const multibyte = request(JSON.stringify({ name: "é".repeat(130_000) }));
  assert.equal((await adminMutation(multibyte, async () => { assert.fail("must not run"); })).status, 413);
});
test("service conflicts and field errors retain their contracts; unexpected details stay private", async () => {
  const conflict = await adminMutation(request(), async () => { throw new AdminError("Atualize a página.", 409); });
  assert.equal(conflict.status, 409);
  const fields = await adminMutation(request(), async () => { throw new FormValidationError({ email: "Confira o email" }); });
  assert.equal(fields.status, 400); assert.deepEqual((await fields.json()).fieldErrors, { email: "Confira o email" });
  const unexpected = await adminMutation(request(), async () => { throw { cause: { code: "XX000", query: "private SQL", detail: "private row" } }; });
  assert.equal(unexpected.status, 500); assert(!JSON.stringify(await unexpected.json()).includes("private"));
});
test("unique conflicts distinguish email, turma and other constraints", async () => {
  for (const [constraint, expected] of [["gallery_users_email_normalized_idx", /email/], ["gallery_turmas_number_idx", /turma/], ["gallery_users_slug_idx", /cadastro/]] as const) {
    const response = await adminMutation(request(), async () => { throw { cause: { code: "23505", constraint } }; });
    assert.equal(response.status, 409); assert.match((await response.json()).error, expected);
  }
});
