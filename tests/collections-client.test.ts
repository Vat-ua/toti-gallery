import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { requestCollectionPage } from "../src/lib/collections-client";
import { COLLECTION_PAGE_SIZE as SIZE, collectionPage } from "../src/lib/collection-page";

const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });

test("collection reads preserve scope, repeated technologies, page, abort signal and no-store", async () => {
  const signal = new AbortController().signal;
  globalThis.fetch = async (path, options) => {
    const url = new URL(String(path), 'http://local.invalid');
    assert.equal(url.pathname, '/api/projects'); assert.equal(url.searchParams.get('view'), 'gallery');
    assert.deepEqual(url.searchParams.getAll('tech'), ['React', 'CSS']); assert.equal(url.searchParams.get('page'), '2');
    assert.equal(options?.signal, signal); assert.equal(options?.cache, 'no-store');
    return Response.json({ items: [{ id: 'project' }], total: SIZE + 1, page: 2, pageSize: SIZE, hasMore: false, previousId: "previous" });
  };
  assert.equal((await requestCollectionPage('/api/projects?view=gallery', new URLSearchParams('tech=React&tech=CSS&page=2'), signal)).items.length, 1);
});

test("malformed list responses, expired sessions and network loss remain recoverable errors", async () => {
  const empty = { items: [], total: 0, page: 1, pageSize: SIZE, hasMore: false, previousId: null };
  for (const data of [null, [], {}, { ...empty, total: -1 }, { ...empty, page: 0 },
    { ...empty, hasMore: true }, { ...empty, previousId: 'unexpected' }, { ...empty, total: 1 },
    { ...empty, items: Array.from({ length: SIZE + 1 }, (_, id) => ({ id: String(id) })), total: SIZE + 1 },
    { ...empty, items: [{ id: 'duplicate' }, { id: 'duplicate' }], total: 2 }]) {
    globalThis.fetch = async () => Response.json(data);
    await assert.rejects(() => requestCollectionPage('/api/projects?view=mine', new URLSearchParams(), new AbortController().signal));
  }
  globalThis.fetch = async () => Response.json({ error: 'Entre novamente.' }, { status: 401 });
  await assert.rejects(() => requestCollectionPage('/api/projects?view=mine', new URLSearchParams(), new AbortController().signal), /Entre novamente/);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => requestCollectionPage('/api/people', new URLSearchParams(), new AbortController().signal), /Confira sua conexão/);
});

test("page clamping rejects unbounded/invalid offsets while retaining the last populated page", () => {
  for (const value of [0, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(collectionPage(value, 50), 1);
  assert.equal(collectionPage(999999999, SIZE * 2 + 1), 3); assert.equal(collectionPage(2, 0), 1);
});
