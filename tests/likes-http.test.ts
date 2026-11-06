import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(`${process.cwd()}/package.json`), saved = new Map<string, NodeJS.Module | undefined>();
function replace(path: string, exports: object) { const id = require.resolve(path); saved.set(id, require.cache[id]); require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module; }
let visitorId: string | undefined, allowed = true, writes = 0, reads = 0, limits = 0;
const id = "11111111-1111-1111-1111-111111111111", legacy = "22222222-2222-2222-2222-222222222222";
replace("./src/lib/auth.ts", { isSameOrigin: (request: Request) => request.headers.get("origin") === "http://localhost:3000" });
replace("next/headers", { cookies: async () => ({ get: () => visitorId ? { value: visitorId } : undefined, set: (_name: string, value: string, options: { httpOnly: boolean }) => { assert.equal(options.httpOnly, true); visitorId = value; } }) });
replace("./src/lib/auth-rate-limit.ts", { allowAttempt: async (scope: string, identity: string, max: number, window: number) => { limits++; assert.equal(scope, "project-like"); assert.equal(identity, visitorId); assert.equal(max, 60); assert.equal(window, 60); return allowed; } });
replace("./src/lib/project-likes.ts", { setProjectLike: async (_project: string, _visitor: string, liked: boolean) => { writes++; return { liked, likes: liked ? 1 : 0 }; }, readProjectLike: async () => { reads++; return { liked: false, likes: 0 }; } });
const route = require("./src/app/api/projects/[id]/like/route.ts") as typeof import("../src/app/api/projects/[id]/like/route");
const bootstrap = require("./src/app/api/visitor/route.ts") as typeof import("../src/app/api/visitor/route");
const context = { params: Promise.resolve({ id: "fixture" }) };
const input = (body: string, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/fixture", { method: "POST", headers: { origin }, body });
beforeEach(() => { visitorId = id; allowed = true; writes = 0; reads = 0; limits = 0; });
after(() => { for (const [path, original] of saved) { if (original) require.cache[path] = original; else delete require.cache[path]; } });
test("only matching-origin, bounded, explicit boolean mutations reach SQL", async () => {
  assert.equal((await route.POST(input('{"liked":true}', "https://foreign.invalid"), context)).status, 403);
  for (const value of ["{}", "null", '{"liked":"true"}', '{"liked":1}', "{"]) assert.equal((await route.POST(input(value), context)).status, 400);
  assert.equal((await route.POST(input(" ".repeat(257)), context)).status, 413); assert.equal(writes, 0); assert.equal(limits, 0);
  const response = await route.POST(input('{"liked":false}'), context); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { liked: false, likes: 0 }); assert.equal(response.headers.get("cache-control"), "no-store");
});
test("missing identity never creates a new voter as a side effect of a write", async () => {
  visitorId = undefined; assert.equal((await route.POST(input('{"liked":true}'), context)).status, 409); assert.equal(writes, 0); assert.equal(limits, 0);
});
test("429 rejects before the mutation and gives the browser a retry delay", async () => {
  allowed = false; const response = await route.POST(input('{"liked":true}'), context);
  assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "60"); assert.equal(writes, 0); assert.equal(limits, 1);
});
test("reading state does not create identity or consume the mutation quota", async () => {
  visitorId = undefined; const response = await route.GET(input("{}"), context); assert.equal(response.status, 200); assert.equal(reads, 1); assert.equal(limits, 0); assert.equal(visitorId, undefined);
});
test("bootstrap reuses established cookies and stable client identity without writing SQL", async () => {
  visitorId = legacy; assert.equal((await (await bootstrap.POST(input(JSON.stringify({ visitorId: id })))).json()).visitorId, legacy);
  visitorId = undefined; assert.equal((await (await bootstrap.POST(input(JSON.stringify({ visitorId: id })))).json()).visitorId, id);
  visitorId = undefined; await bootstrap.POST(input(JSON.stringify({ visitorId: id }))); assert.equal(visitorId, id); assert.equal(writes, 0); assert.equal(limits, 0);
});
test("bootstrap is origin checked and rejects malformed or oversized identifiers", async () => {
  visitorId = undefined;
  assert.equal((await bootstrap.POST(input("{}", "https://foreign.invalid"))).status, 403);
  assert.equal((await bootstrap.POST(input('{"visitorId":"invalid"}'))).status, 400);
  assert.equal((await bootstrap.POST(input(" ".repeat(257)))).status, 413); assert.equal(visitorId, undefined);
});
