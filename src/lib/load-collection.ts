import { collectionPage, type CollectionPage, type CollectionSnapshot } from "./collection-page";

/** A live OFFSET list: validate adjacent batches, rebuilding after detected drift. */
export async function loadCollection<T extends { id: string }>(
  previous: CollectionSnapshot<T> | null,
  target: number,
  read: (page: number) => Promise<CollectionPage<T>>,
  publish: (snapshot: CollectionSnapshot<T>) => void,
  signal: AbortSignal,
) {
  if (previous && target < previous.loadedPages) {
    const loadedPages = collectionPage(target, previous.total);
    const snapshot = { ...previous, loadedPages, items: previous.items.slice(0, loadedPages * previous.pageSize), hasMore: loadedPages * previous.pageSize < previous.total };
    publish(snapshot); return;
  }
  let result = previous, repairing = false, restarts = 0;
  while (!signal.aborted) {
    const page = result ? result.loadedPages + 1 : 1;
    const batch = await read(page);
    if (signal.aborted) return;
    const seen = new Set(result?.items.map(item => item.id));
    if (result && (batch.page !== page || batch.total !== result.total
      || batch.previousId !== result.items.at(-1)?.id || batch.items.some(item => seen.has(item.id)))) {
      if (++restarts > 2) throw new Error("A lista mudou durante o carregamento. Tente novamente para atualizá-la.");
      result = null; repairing = true; continue;
    }
    result = { items: [...(result?.items || []), ...batch.items], total: batch.total,
      loadedPages: batch.page, pageSize: batch.pageSize, hasMore: batch.hasMore };
    const done = !result.hasMore || result.loadedPages >= collectionPage(target, result.total);
    // During a repair retain the prior visible list until the replacement is complete.
    if (!repairing || done) publish(result);
    if (done) return;
  }
}
