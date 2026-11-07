import { requestJson } from "./http-client";
import { COLLECTION_PAGE_SIZE, type CollectionPage } from "./collection-page";

export async function requestCollectionPage<T extends { id: string }>(endpoint: string, params: URLSearchParams, signal: AbortSignal): Promise<CollectionPage<T>> {
  const url = new URL(endpoint, "http://local.invalid");
  for (const [key, value] of params) url.searchParams.append(key, value);
  const message = "Não foi possível atualizar a lista.";
  const data = await requestJson(url.pathname + url.search, { signal, cache: "no-store" }, message);
  if (!Array.isArray(data.items) || data.items.length > COLLECTION_PAGE_SIZE || data.items.some(item => !item || typeof item.id !== "string")
    || !Number.isSafeInteger(data.total) || (data.total as number) < 0
    || typeof data.hasMore !== "boolean" || (data.previousId !== null && typeof data.previousId !== "string")
    || !Number.isSafeInteger(data.page) || (data.page as number) < 1 || data.pageSize !== COLLECTION_PAGE_SIZE) throw new Error(message);
  const batch = data as CollectionPage<T>;
  const offset = (batch.page - 1) * COLLECTION_PAGE_SIZE;
  if (batch.hasMore !== (offset + batch.items.length < batch.total)
    || batch.items.length !== Math.min(COLLECTION_PAGE_SIZE, Math.max(0, batch.total - offset))
    || batch.page > Math.max(1, Math.ceil(batch.total / COLLECTION_PAGE_SIZE))
    || (batch.page === 1 ? batch.previousId !== null : !batch.previousId)
    || new Set(batch.items.map(item => item.id)).size !== batch.items.length) throw new Error(message);
  return batch;
}
