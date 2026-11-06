import { after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(`${process.cwd()}/package.json`), path = require.resolve("./src/lib/browser-visitor.ts"), saved = require.cache[path];
let prepared = 0;
require.cache[path] = { id: path, filename: path, loaded: true, exports: { ensureBrowserVisitor: async () => { prepared++; } } } as NodeJS.Module;
const { saveLike, LikeRequestError } = require("./src/lib/likes-client.ts") as typeof import("../src/lib/likes-client");
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; prepared = 0; });
after(() => { if (saved) require.cache[path] = saved; else delete require.cache[path]; });
test("identity is prepared before an explicit boolean state is submitted", async () => {
  globalThis.fetch = async (_path, init) => { assert.equal(prepared, 1); assert.equal(init?.method, "POST"); assert.deepEqual(JSON.parse(String(init.body)), { liked: false }); return Response.json({ liked: false, likes: 5 }); };
  assert.deepEqual(await saveLike("project", false), { liked: false, likes: 5 });
});
test("lost successful response is reconciled without toggling or blindly resending the write", async () => {
  const methods: string[] = [];
  globalThis.fetch = async (_path, init) => { methods.push(init!.method!); if (init?.method === "POST") throw new TypeError("Lost response"); return Response.json({ liked: true, likes: 6 }); };
  assert.deepEqual(await saveLike("project", true), { liked: true, likes: 6 }); assert.deepEqual(methods, ["POST", "GET"]);
});
test("a failed write with a readable different state reports the confirmed result", async () => {
  globalThis.fetch = async (_path, init) => init?.method === "POST" ? new Response("gateway failure", { status: 503 }) : Response.json({ liked: false, likes: 5 });
  await assert.rejects(saveLike("project", true), error => error instanceof LikeRequestError && error.confirmed?.liked === false);
});
test("rate limits and permanent errors do not trigger extra reads or retries", async () => {
  for (const status of [400, 403, 404, 409, 429]) {
    let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({ error: "Aguarde e tente novamente." }, { status }); };
    await assert.rejects(saveLike("project", true), /Aguarde/); assert.equal(calls, 1);
  }
});
test("complete loss of connectivity remains recoverable and malformed success is not accepted", async () => {
  globalThis.fetch = async () => { throw new TypeError("offline"); };
  await assert.rejects(saveLike("project", true), error => error instanceof LikeRequestError && !error.confirmed);
  globalThis.fetch = async () => Response.json({ liked: "yes", likes: -1 }); await assert.rejects(saveLike("project", true));
});
