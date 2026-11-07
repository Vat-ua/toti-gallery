"use client";

import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { galleryFilterParams, readGalleryFilters } from "@/lib/gallery-filters";
import type { CollectionFilterMode, GalleryFilters } from "@/lib/gallery-filters";

type FilterUpdate = Partial<GalleryFilters> | ((current: GalleryFilters) => GalleryFilters);

export function useGalleryFilters(mode: CollectionFilterMode = "gallery") {
  const params = useSearchParams();
  const urlFilters = useMemo(() => readGalleryFilters(params, mode), [params, mode]);
  const [optimisticFilters, setOptimisticFilters] = useOptimistic(urlFilters);
  const [draft, setDraft] = useState({
    source: urlFilters.query,
    value: urlFilters.query,
    pending: null as string | null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore external navigation, while keeping newer typing during our own URL update.
  let query = draft.value;
  if (draft.source !== urlFilters.query) {
    query = draft.pending === urlFilters.query ? draft.value : urlFilters.query;
    setDraft({ source: urlFilters.query, value: query, pending: null });
  }

  useEffect(() => {
    function restoreSearch() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      const value = new URLSearchParams(window.location.search).get("q") || "";
      setDraft((current) => ({ ...current, value, pending: value }));
    }
    window.addEventListener("popstate", restoreSearch);
    return () => {
      window.removeEventListener("popstate", restoreSearch);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, [params]);

  function cancelSearch() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function writeUrl(next: GalleryFilters, mode: "push" | "replace") {
    const search = galleryFilterParams(next).toString();
    const url = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (url === current) return;
    setDraft((value) => ({ ...value, pending: next.query }));
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  function updateFilters(update: FilterUpdate) {
    cancelSearch();
    const persisted = readGalleryFilters(new URLSearchParams(window.location.search), mode);
    const current = { ...persisted, query };
    const next = typeof update === "function" ? update(current) : { ...current, ...update };
    const changed = galleryFilterParams({ ...next, page: 1 }).toString()
      !== galleryFilterParams({ ...persisted, page: 1 }).toString();
    next.page = changed ? 1 : persisted.page;
    setDraft((value) => ({ ...value, value: next.query }));
    startTransition(() => {
      setOptimisticFilters(next);
      writeUrl(next, "push");
    });
  }

  function commitQuery(value: string) {
    cancelSearch();
    const current = readGalleryFilters(new URLSearchParams(window.location.search), mode);
    writeUrl({ ...current, query: value, page: value === current.query ? current.page : 1 }, "replace");
  }

  function changeQuery(value: string) {
    cancelSearch();
    setDraft((current) => ({ ...current, value }));
    if (!value) commitQuery(value);
    else timerRef.current = setTimeout(() => commitQuery(value), 300);
  }

  function flushQuery() {
    if (timerRef.current) commitQuery(query);
  }

  function changePage(page: number) {
    cancelSearch();
    const current = readGalleryFilters(new URLSearchParams(window.location.search), mode);
    const next = { ...current, query, page };
    startTransition(() => {
      setOptimisticFilters(next);
      // Loading more extends the current result set without adding a Back step.
      writeUrl(next, "replace");
    });
  }

  return {
    filters: { ...optimisticFilters, query, page: query === optimisticFilters.query ? optimisticFilters.page : 1 },
    updateFilters, changeQuery, flushQuery, changePage,
  };
}
