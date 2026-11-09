import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { inspect } from "node:util";
import { PublicError } from "../src/lib/errors";
import { serverErrorResponse } from "../src/lib/server-response";

const require = createRequire(import.meta.url), saved = new Map<string, NodeJS.Module | undefined>();
let sessionFailure: unknown, accountFailure: unknown, guest = false, accountReads = 0;
const secret = "fixture-session-token-that-must-not-reach-next";
const person = { id: "fixture", name: "Fixture", role: "user" };
function replace(path: string, exports: object) {
  const id = require.resolve(path); saved.set(id, require.cache[id]);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
}
replace("next/headers", { headers: async () => new Headers() });
replace("../src/lib/auth-core.ts", { getAuth: () => ({ api: { getSession: async () => {
  if (sessionFailure) throw sessionFailure;
  return guest ? null : { user: { id: person.id } };
} } }) });
replace("../src/lib/queries.ts", { getActiveAccountPerson: async () => {
  accountReads++; if (accountFailure) throw accountFailure; return person;
} });
const auth = require("../src/lib/auth.ts") as typeof import("../src/lib/auth");
const originalConsole = console.error, logs: string[] = [];
console.error = value => logs.push(String(value));
beforeEach(() => { sessionFailure = undefined; accountFailure = undefined; guest = false; accountReads = 0; logs.length = 0; });
after(() => {
  console.error = originalConsole;
  for (const [id, value] of saved) { if (value) require.cache[id] = value; else delete require.cache[id]; }
});

test("failed session reads throw a safe server error instead of exposing SQL/token causes or becoming guests", async () => {
  sessionFailure = Object.assign(new Error("Failed query params: " + secret), { code: "ECONNRESET", query: secret, parameters: [secret] });
  let failure: PublicError | undefined;
  await assert.rejects(() => auth.getCurrentUser(), error => {
    assert(error instanceof PublicError); failure = error;
    assert.equal(error.status, 503); assert(!("cause" in error)); assert(!inspect(error).includes(secret));
    return true;
  });
  assert.equal(accountReads, 0);
  const first = JSON.parse(logs[0]); assert.equal(first.code, "ECONNRESET"); assert.equal(first.operation, "auth.session");
  assert.equal(first.requestId, failure!.requestId);
  const response = serverErrorResponse(failure, "Fallback", "fixture.private");
  assert.equal(response.status, 503); assert.equal((await response.json()).requestId, first.requestId);
  assert.equal(response.headers.get("x-request-id"), first.requestId); assert(!logs.join("").includes(secret));
});

test("failed account projections remain private 500s and strict ownership cannot authorize them", async () => {
  accountFailure = new TypeError(secret);
  for (const read of [() => auth.getCurrentUser(), () => auth.isCurrentUser(person.id)]) {
    await assert.rejects(read, error => {
      assert(error instanceof PublicError); assert.equal(error.status, 500);
      assert(!("cause" in error)); assert(!inspect(error).includes(secret)); return true;
    });
  }
  assert.equal(JSON.parse(logs[0]).errorKind, "TypeError"); assert.equal(JSON.parse(logs[0]).operation, "auth.account");
  assert(!logs.join("").includes(secret));
});

test("successful/anonymous identity behavior and framework control flow stay unchanged", async () => {
  assert.deepEqual(await auth.getCurrentUser(), person);
  guest = true; accountReads = 0;
  assert.equal(await auth.getCurrentUser(), null); assert.equal(accountReads, 0);
  sessionFailure = Object.assign(new Error("Framework signal"), { digest: "DYNAMIC_SERVER_USAGE" });
  await assert.rejects(() => auth.getCurrentUser(), error => error === sessionFailure);
  assert.deepEqual(logs, []);
});
