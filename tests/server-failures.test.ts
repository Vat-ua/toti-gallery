import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PublicError } from "../src/lib/errors";
import { FormValidationError } from "../src/lib/form-validation";
import { serverErrorResponse } from "../src/lib/server-response";
import { errorDetails, logServerError } from "../src/lib/server-log";
const require = createRequire(`${process.cwd()}/package.json`);
let authResponseStatus = 200;
const saved = new Map<string, NodeJS.Module | undefined>();
const replace = (path: string, exports: object) => { const id = require.resolve(path); saved.set(id, require.cache[id]); require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module; };
const secret = "sensitive-password-token-email@example.invalid";
const failure = Object.assign(new Error(secret), { code: "ECONNRESET", query: secret });
let sessionFailure = false, limitFailure = false, limitAllowed = true, serviceFailure = false, consumeCalls = 0, passwordCalls = 0, inspectCalls = 0;
replace("./src/lib/auth.ts", { isSameOrigin: (request: Request) => request.headers.get("origin") === "http://localhost:3000", getCurrentUser: async () => { if (sessionFailure) throw failure; return { id: "fixture", avatar: null, role: "admin" }; } });
replace("./src/lib/auth-rate-limit.ts", { requestIP: () => "local", allowAttempt: async () => { if (limitFailure) throw failure; return limitAllowed; } });
replace("next/headers", { headers: async () => new Headers() });
replace("next/server", { after: () => {} });
replace("./src/db/index.ts", { db: {} });
replace("./src/lib/auth-core.ts", { getAuth: () => ({ handler: async () => Response.json({ message: secret }, { status: authResponseStatus }), api: { changePassword: async () => { passwordCalls++; if (serviceFailure) throw failure; return Response.json({ ok: true }, { headers: { "set-cookie": "fixture=changed; HttpOnly" } }); } } }) });
class AccessError extends PublicError {}
replace("./src/lib/access-links.ts", { AccessError, inspectAccessLink: async () => { inspectCalls++; if (serviceFailure) throw failure; return { email: "fixture@example.invalid", purpose: "activation", expiresAt: "2030-01-01" }; }, consumeAccessLink: async () => { consumeCalls++; if (serviceFailure) throw failure; } });
replace("./src/lib/account-mutations.ts", { updateAccountProfile: async () => { throw failure; } });
replace("./src/lib/image-storage.ts", { retireImage: async () => {} });
const authRoutes = require("./src/app/api/auth/[...all]/route.ts") as typeof import("../src/app/api/auth/[...all]/route");
const access = require("./src/app/api/access/route.ts") as typeof import("../src/app/api/access/route");
const password = require("./src/app/api/account/password/route.ts") as typeof import("../src/app/api/account/password/route");
const profile = require("./src/app/api/account/route.ts") as typeof import("../src/app/api/account/route");
const { adminMutation } = require("./src/lib/admin-http.ts") as typeof import("../src/lib/admin-http");
const originalConsole = console.error, logs: string[] = [];
console.error = value => logs.push(String(value));
const request = (body: string) => new Request("http://localhost:3000/api/fixture", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body });
const validPassword = JSON.stringify({ currentPassword: "old-password-long-enough", newPassword: "new-password-long-enough", confirmPassword: "new-password-long-enough" });
beforeEach(() => { authResponseStatus = 200; sessionFailure = false; limitFailure = false; limitAllowed = true; serviceFailure = false; consumeCalls = 0; passwordCalls = 0; inspectCalls = 0; logs.length = 0; });
after(() => { console.error = originalConsole; for (const [id, original] of saved) { if (original) require.cache[id] = original; else delete require.cache[id]; } });
test("expected field and conflict errors remain usable, while unknown errors become private 500/503", async () => {
  const field = serverErrorResponse(new FormValidationError({ title: "Confira o título" }), "Fallback", "project.create");
  assert.equal(field.status, 400); assert.deepEqual((await field.json()).fieldErrors, { title: "Confira o título" });
  assert.equal(serverErrorResponse(new PublicError("Atualize a página", 409), "Fallback", "project.update").status, 409);
  for (const [error, status] of [[new Error(secret), 500], [{ cause: failure }, 503]] as const) {
    const response = serverErrorResponse(error, "Tente novamente.", "project.create");
    assert.equal(response.status, status); const body = await response.json();
    assert.equal(body.error, "Tente novamente."); assert.equal(body.requestId, response.headers.get("x-request-id")); assert.ok(!JSON.stringify(body).includes(secret)); assert.equal(response.headers.get("cache-control"), "no-store");
  }
});
test("logs reject arbitrary context, raw messages, SQL, passwords, tokens, stacks and cyclic causes", () => {
  const error = Object.assign(new Error(secret), { cause: failure });
  logServerError("request.failed", error, { operation: "account.password", digest: secret, ...{ body: secret, headers: secret } });
  const log = JSON.parse(logs[0]); assert.equal(log.code, "ECONNRESET"); assert.equal(log.operation, "account.password");
  assert.ok(!logs[0].includes(secret)); assert.equal(log.digest, undefined); assert.equal(log.body, undefined); assert.equal(log.headers, undefined);
  const circular: { cause?: unknown } = {}; circular.cause = circular; assert.equal(errorDetails(circular).category, "unexpected");
  assert.equal(errorDetails(new Error("Query read timeout")).unavailable, true);
  assert.deepEqual(errorDetails({ code: "42703" }), { category: "database", code: "42703", unavailable: false });
  logServerError("request.failed", failure);
  assert.equal(JSON.parse(logs[1]).fingerprint, log.fingerprint, "wrapping the same cause must retain its diagnostic fingerprint");
});
test("activation and password routes reject oversized streams before credential operations", async () => {
  for (const [handler, chunkSize] of [[access.POST, 1024], [password.POST, 4096]] as const) {
    let canceled = false, pulls = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(chunkSize)); }, cancel() { canceled = true; } });
    const input = new Request("http://localhost:3000/api/fixture", { method: "POST", headers: { origin: "http://localhost:3000", "content-length": "1" }, body: stream, duplex: "half" } as RequestInit);
    const result = await handler(input); assert.equal(result.status, 413); assert.ok(canceled); assert.ok(pulls <= 4);
  }
  assert.equal(consumeCalls, 0); assert.equal(passwordCalls, 0);
});
test("limits measure UTF-8 bytes and reject oversized declared content length", async () => {
  assert.equal((await access.POST(request(JSON.stringify({ token: "é".repeat(1100) })))).status, 413);
  const input = request("{}"); input.headers.set("content-length", "8193"); assert.equal((await password.POST(input)).status, 413);
  assert.equal(consumeCalls, 0); assert.equal(passwordCalls, 0);
});
test("malformed JSON never reflects a password or executes a credential operation", async () => {
  for (const handler of [access.POST, password.POST]) {
    const result = await handler(request(`{"password":"${secret}",`));
    assert.equal(result.status, 400); assert.ok(!JSON.stringify(await result.json()).includes(secret));
  }
  assert.equal(consumeCalls, 0); assert.equal(passwordCalls, 0);
});
test("database failure in session lookup and throttling returns safe service errors", async () => {
  sessionFailure = true;
  for (const response of [await password.POST(request(validPassword)), await profile.PATCH(request("{}")), await adminMutation(request("{}"), async () => assert.fail("must not run"))]) assert.equal(response.status, 503);
  sessionFailure = false; limitFailure = true;
  assert.equal((await access.POST(request("{}"))).status, 503); assert.equal((await password.POST(request(validPassword))).status, 503);
  assert.equal(consumeCalls, 0); assert.equal(passwordCalls, 0); assert.ok(!logs.join("").includes(secret));
});
test("dependency failure does not become a user-input error; successful password retains cookies", async () => {
  serviceFailure = true;
  assert.equal((await access.POST(request('{"token":"fixture"}'))).status, 503);
  assert.equal((await password.POST(request(validPassword))).status, 503);
  serviceFailure = false;
  const result = await password.POST(request(validPassword)); assert.equal(result.status, 200); assert.match(result.headers.get("set-cookie")!, /fixture=changed/);
  assert.equal((await access.POST(request('{"action":"inspect","token":"fixture"}'))).status, 200); assert.equal(inspectCalls, 1);
});
test("throttled requests remain 429 and never redeem a token or change credentials", async () => {
  limitAllowed = false;
  for (const handler of [access.POST, password.POST]) assert.equal((await handler(request(validPassword))).status, 429);
  assert.equal(consumeCalls, 0); assert.equal(passwordCalls, 0);
});

test("native authentication failures stay private and the endpoint allowlist remains closed", async () => {
  authResponseStatus = 500;
  const response = await authRoutes.POST(new Request("http://localhost:3000/api/auth/sign-in/email", { method: "POST" }));
  assert.equal(response.status, 500); assert.ok(!JSON.stringify(await response.json()).includes(secret));
  assert.equal((await authRoutes.POST(new Request("http://localhost:3000/api/auth/sign-up/email", { method: "POST" }))).status, 403);
});
