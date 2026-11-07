import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCollection } from "../src/lib/load-collection";
import { COLLECTION_PAGE_SIZE as SIZE, type CollectionPage, type CollectionSnapshot } from "../src/lib/collection-page";

type Item = { id: string };
const items = (count: number) => Array.from({ length: count }, (_, id) => ({ id: String(id) }));
function batch(rows: Item[], page: number): CollectionPage<Item> {
  page = Math.min(page, Math.max(1, Math.ceil(rows.length / SIZE)));
  return { items: rows.slice((page - 1) * SIZE, page * SIZE), total: rows.length, page, pageSize: SIZE,
    previousId: rows[(page - 1) * SIZE - 1]?.id || null, hasMore: page * SIZE < rows.length };
}
function initial(rows: Item[]): CollectionSnapshot<Item> {
  return { items: rows.slice(0, SIZE), total: rows.length, loadedPages: 1, pageSize: SIZE, hasMore: rows.length > SIZE };
}
test("append only requests the next batch and uses the server end marker", async () => {
  const rows = items(SIZE + 3), calls: number[] = [], output: CollectionSnapshot<Item>[] = [];
  await loadCollection(initial(rows), 2, async page => { calls.push(page); return batch(rows, page); }, data => output.push(data), new AbortController().signal);
  assert.deepEqual(calls, [2]); assert.equal(output.at(-1)?.hasMore, false); assert.deepEqual(output.at(-1)?.items, rows);
});
test("insertions, removals and same-count reorderings rebuild the prefix instead of leaving gaps or a dead button", async () => {
  const rows = items(SIZE * 2);
  for (const changed of [[{ id: 'new' }, ...rows], rows.slice(1), [rows.at(-1)!, ...rows.slice(0, -1)]]) {
    const calls: number[] = [], output: CollectionSnapshot<Item>[] = [];
    await loadCollection(initial(rows), 3, async page => { calls.push(page); return batch(changed, page); }, data => output.push(data), new AbortController().signal);
    assert.deepEqual(calls.slice(0, 2), [2, 1]);
    assert.deepEqual(output.at(-1)?.items, changed); assert.equal(output.at(-1)?.hasMore, false);
    assert.equal(output.length, 1, 'Do not flash partial replacement lists while repairing');
  }
});
test("continuous concurrent changes stop with a recoverable error instead of looping", async () => {
  let calls = 0;
  await assert.rejects(loadCollection(initial(items(SIZE * 3)), 3, async page => {
    calls++; return batch(items(SIZE * 3 + calls), page);
  }, () => {}, new AbortController().signal), /lista mudou/);
  assert(calls <= 6);
});
test("restore publishes bounded batches progressively; going back slices without a request", async () => {
  const rows = items(SIZE * 4 + 1), output: CollectionSnapshot<Item>[] = [];
  await loadCollection(initial(rows), 5, async page => batch(rows, page), data => output.push(data), new AbortController().signal);
  assert.deepEqual(output.map(value => value.loadedPages), [2, 3, 4, 5]);
  await loadCollection(output.at(-1)!, 2, async () => { throw Error('Unexpected network read'); }, data => {
    assert.equal(data.items.length, SIZE * 2); assert.equal(data.hasMore, true);
  }, new AbortController().signal);
});
test("network failure retains prior published batches and an aborted late response is ignored", async () => {
  const rows = items(SIZE * 3), output: CollectionSnapshot<Item>[] = [];
  await assert.rejects(loadCollection(initial(rows), 3, async page => {
    if (page === 3) throw Error('offline'); return batch(rows, page);
  }, data => output.push(data), new AbortController().signal), /offline/);
  assert.equal(output.at(-1)?.loadedPages, 2);
  const controller = new AbortController();
  await loadCollection(initial(rows), 2, async page => { controller.abort(); return batch(rows, page); }, () => assert.fail('An obsolete response was published'), controller.signal);
});
