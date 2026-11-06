import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { ImageMetadata } from "../src/lib/image-policy";
const require = createRequire(`${process.cwd()}/package.json`);
const saved = new Map<string, NodeJS.Module | undefined>();
const replace = (path: string, exports: object) => { const id = require.resolve(path); saved.set(id, require.cache[id]); require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module; };
let mode = "success", cleanup = 0, committed = false;
const failure = Object.assign(new Error("Sensitive database details"), { code: "ECONNRESET" });
replace("./src/db/index.ts", { db: { transaction: async (work: (tx: object) => Promise<unknown>) => {
  const value = await work({});
  if (mode === "lost-ack") { committed = true; throw failure; }
  if (mode === "commit-rejected") throw failure;
  committed = true; return value;
} } });
replace("./src/lib/image-storage.ts", { retireImage: async () => { cleanup++; } });
const { commitImageChange } = require("./src/lib/image-transaction.ts") as typeof import("../src/lib/image-transaction");
const upload: ImageMetadata = { key: "avatars/11111111-1111-1111-1111-111111111111.webp", width: 10, height: 10, bytes: 100, format: "webp" };
const logs: string[] = [], originalConsole = console.error;
console.error = value => { logs.push(String(value)); };
beforeEach(() => { mode = "success"; cleanup = 0; committed = false; logs.length = 0; });
after(() => { console.error = originalConsole; for (const [id, original] of saved) { if (original) require.cache[id] = original; else delete require.cache[id]; } });
test("acknowledged commit keeps the new object and returns the operation result", async () => {
  assert.deepEqual(await commitImageChange(upload, async () => ({ id: "saved" })), { id: "saved" });
  assert.equal(committed, true); assert.equal(cleanup, 0);
});
test("completed commit with lost acknowledgement never deletes the referenced object", async () => {
  mode = "lost-ack";
  await assert.rejects(commitImageChange(upload, async () => "saved"), error => error instanceof Error && error.cause === failure);
  assert.equal(committed, true); assert.equal(cleanup, 0);
  assert.equal(JSON.parse(logs[0]).event, "image.commit.unconfirmed");
  assert.ok(!logs.join("").includes("Sensitive"));
});
test("uncertain commit with no currently visible reference also retains the object", async () => {
  mode = "commit-rejected";
  await assert.rejects(commitImageChange(upload, async () => "ready"), error => error instanceof Error && error.cause === failure);
  assert.equal(committed, false); assert.equal(cleanup, 0);
});
test("a failure inside the transaction checks references before retiring the new upload", async () => {
  await assert.rejects(commitImageChange(upload, async () => { throw failure; }), error => error === failure);
  assert.equal(committed, false); assert.equal(cleanup, 1);
});
test("operations without an upload never attempt object cleanup on failure", async () => {
  await assert.rejects(commitImageChange(undefined, async () => { throw failure; })); assert.equal(cleanup, 0);
});
