import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AdminError } from "../src/lib/admin-server";
import { COLLECTION_PAGE_SIZE } from "../src/lib/collection-page";

const require = createRequire(`${process.cwd()}/package.json`);
const originals = new Map<string, NodeJS.Module | undefined>();
let actor: { id: string; role: string } | null, failure: Error | null, calls: unknown[][];
function replace(path: string, exports: object) {
  const id = require.resolve(path); originals.set(id, require.cache[id]);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
}
replace("./src/lib/auth.ts", { getCurrentUser: async () => actor });
replace("./src/lib/admin-projects.ts", { readAdminProjectPage: async (...args: unknown[]) => {
  calls.push(args); if (failure) throw failure;
  return { items: [], page: 1, pageSize: COLLECTION_PAGE_SIZE, total: 0, hasMore: false, previousId: null };
} });
const { GET } = require("./src/app/api/admin/projetos/route.ts") as typeof import("../src/app/api/admin/projetos/route");
after(() => { for (const [id, value] of originals) { if (value) require.cache[id] = value; else delete require.cache[id]; } });
beforeEach(() => { actor = { id: "staff", role: "admin" }; failure = null; calls = []; });
const request = () => new Request("https://example.invalid/api/admin/projetos?q=React&turma=fixture&visibility=hidden&page=2&userId=intruder");

test("admin batches reject guests and students before reading private projects", async () => {
  actor = null; assert.equal((await GET(request())).status, 401);
  actor = { id: "student", role: "user" }; assert.equal((await GET(request())).status, 403);
  assert.equal(calls.length, 0);
});
test("admin batches use the verified actor and normalized filters, with no shared cache", async () => {
  for (const role of ["admin", "owner"]) {
    actor = { id: "verified", role };
    const response = await GET(request());
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(calls.at(-1), ["verified", { query: "React", turmaId: "fixture", visibility: "hidden", page: 2 }]);
    assert.equal((await response.json()).pageSize, COLLECTION_PAGE_SIZE);
  }
});
test("a rejected live permission check remains forbidden", async () => {
  failure = new AdminError("Acesso restrito à administração.", 403);
  const response = await GET(request());
  assert.equal(response.status, 403); assert.equal(response.headers.get("cache-control"), "no-store");
});
