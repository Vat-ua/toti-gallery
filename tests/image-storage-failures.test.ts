import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { ImageMetadata } from "../src/lib/image-policy";
const require = createRequire(`${process.cwd()}/package.json`);
const saved = new Map<string, NodeJS.Module | undefined>();
function replace(path: string, exports: object) { const id = require.resolve(path); saved.set(id, require.cache[id]); require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module; }
let queryFailure = false, verifyFailure = false, references = 0, putCount = 0, failPut = 0, failDelete = false, destroyed = 0;
const deleted: string[] = [], logs: string[] = [];
const fail = Object.assign(new Error("postgresql://secret:password@example.invalid private email"), { code: "ECONNRESET" });
replace("./src/db/index.ts", { db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => { if (queryFailure) throw fail; return references ? [{ id: "reference" }] : []; } }) }) }) }, pool: {} });
replace("./src/lib/database-target.cjs", { PRODUCTION: {}, assertDatabaseTarget: async () => { if (verifyFailure) throw fail; } });
replace("./src/lib/image-storage-settings.ts", { storageSettings: () => ({ bucket: "fixture", region: "us-east-1", endpoint: "https://example.invalid" }) });
replace("./src/lib/image-processing.ts", { processImage: async () => ({ image: { width: 100, height: 70, data: Buffer.from("image") }, thumbnail: { width: 60, height: 42, data: Buffer.from("thumb") } }) });
const sdk = require("@aws-sdk/client-s3");
replace("@aws-sdk/client-s3", { ...sdk, S3Client: class {
  async send(command: { input: { Key: string } }) {
    if (command instanceof sdk.PutObjectCommand && ++putCount === failPut) throw fail;
    if (command instanceof sdk.DeleteObjectCommand) { if (failDelete) throw fail; deleted.push(command.input.Key); }
    return {};
  }
  destroy() { destroyed++; }
} });
const { retireImage, saveImage } = require("./src/lib/image-storage.ts") as typeof import("../src/lib/image-storage");
const originalConsole = console.error;
console.error = value => { logs.push(String(value)); };
const image: ImageMetadata = { key: "avatars/11111111-1111-1111-1111-111111111111.webp", width: 10, height: 10, bytes: 100, format: "webp" };
beforeEach(() => { queryFailure = false; verifyFailure = false; references = 0; putCount = 0; failPut = 0; failDelete = false; destroyed = 0; deleted.length = 0; logs.length = 0; });
after(() => { console.error = originalConsole; for (const [id, original] of saved) { if (original) require.cache[id] = original; else delete require.cache[id]; } });
test("unreferenced files are deleted only after both database lookups succeed", async () => {
  await retireImage(image); assert.deepEqual(deleted, [image.key]);
});
test("a referenced object is preserved", async () => { references = 1; await retireImage(image); assert.deepEqual(deleted, []); });
test("unavailable database retains the file and records a safe deferred-cleanup event", async () => {
  queryFailure = true; await retireImage(image); assert.deepEqual(deleted, []);
  assert.equal(JSON.parse(logs[0]).event, "image.retirement.deferred"); assert.ok(!logs.join("").includes("secret"));
});
test("failed object deletion does not turn a committed save into an error", async () => {
  failDelete = true; await retireImage(image); assert.deepEqual(deleted, []); assert.equal(JSON.parse(logs[0]).event, "image.delete.failed"); assert.equal(destroyed, 1);
});
test("partial two-object upload failure attempts cleanup of both keys and returns safe 503", async () => {
  failPut = 2;
  await assert.rejects(saveImage(new File(["image"], "fixture.webp"), "cover"), (error: unknown) => {
    assert.equal((error as { status: number }).status, 503); assert.ok(!(error as Error).message.includes("secret")); return true;
  });
  assert.equal(deleted.length, 2); assert.ok(deleted.some(key => key.endsWith("thumbnail.webp"))); assert.equal(destroyed, 2);
});
test("failed target verification releases the already-created storage client", async () => {
  verifyFailure = true; await assert.rejects(saveImage(new File(["image"], "fixture.webp"), "cover")); assert.equal(putCount, 0); assert.equal(destroyed, 1);
});
