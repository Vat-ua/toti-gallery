/** Shared card batch size, including administrative project cards. */
export const COLLECTION_PAGE_SIZE = 12;
export const INITIAL_COLLECTION_PAGES = 3;

/** One bounded API batch; previousId validates the boundary when appending. */
export type CollectionPage<T> = {
  items: T[]; total: number; page: number; pageSize: number;
  hasMore: boolean; previousId: string | null;
};
/** A cumulative view, distinct from one API batch. */
export type CollectionSnapshot<T> = {
  items: T[]; total: number; loadedPages: number; pageSize: number; hasMore: boolean;
};

export function requestedPage(value: number) {
  return Number.isSafeInteger(value) && value > 0 && value <= Math.floor(Number.MAX_SAFE_INTEGER / COLLECTION_PAGE_SIZE) ? value : 1;
}
export function collectionPage(page: number, total: number) {
  return Math.min(requestedPage(page), Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE)));
}
export function initialCollectionPage(page: number) {
  return Math.min(requestedPage(page), INITIAL_COLLECTION_PAGES);
}
export function collectionSnapshot<T>(batch: CollectionPage<T>): CollectionSnapshot<T> {
  return { items: batch.items, total: batch.total, loadedPages: batch.page, pageSize: batch.pageSize, hasMore: batch.hasMore };
}
export function searchParams(values: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  return params;
}
