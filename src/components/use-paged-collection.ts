"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collectionPage, type CollectionSnapshot } from "@/lib/collection-page";
import { galleryFilterParams, readGalleryFilters, type CollectionFilterMode } from "@/lib/gallery-filters";
import { requestCollectionPage } from "@/lib/collections-client";
import { loadCollection } from "@/lib/load-collection";

/** URL-driven lifecycle; the pure loader owns batching and live-list reconciliation. */
export function usePagedCollection<T extends { id: string }>(initial: CollectionSnapshot<T>, endpoint: string | null, mode: CollectionFilterMode = "page") {
  const url = useSearchParams();
  const filters = useMemo(() => readGalleryFilters(url, mode), [url, mode]);
  const params = galleryFilterParams(filters); params.delete("page");
  const search = params.toString(), key = `${endpoint}?${search}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ source: initial, key, data: initial, error: "", errorKey: "", attempt: -1 });
  const current = state.source === initial ? state : { source: initial, key, data: initial, error: "", errorKey: "", attempt: -1 };
  if (current !== state) setState(current);
  const latest = useRef(current);
  const targetPage = current.key === key ? collectionPage(filters.page, current.data.total) : filters.page;
  const needed = !!endpoint && (current.key !== key || current.data.loadedPages !== targetPage);
  const error = current.errorKey === key && current.attempt === attempt ? current.error : "";
  const pending = needed && !error;

  useEffect(() => { latest.current = current; });
  useEffect(() => {
    const previous = latest.current;
    if (!endpoint || (previous.key === key && previous.data.loadedPages === targetPage)) return;
    const controller = new AbortController();
    const read = (page: number) => {
      const query = new URLSearchParams(search); query.set("page", String(page));
      return requestCollectionPage<T>(endpoint, query, controller.signal);
    };
    void loadCollection(previous.key === key ? previous.data : null, targetPage, read, data => {
      if (!controller.signal.aborted) setState({ source: initial, key, data, error: "", errorKey: "", attempt });
    }, controller.signal).catch(error => {
      if (!controller.signal.aborted) setState(value => ({ ...value, error: error instanceof Error ? error.message : "Não foi possível atualizar a lista.", errorKey: key, attempt }));
    });
    return () => controller.abort();
  }, [initial, endpoint, key, search, targetPage, attempt]);

  return { data: current.data, pending, error: needed ? error : "", retry: () => setAttempt(value => value + 1) };
}
