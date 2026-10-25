"use client";

import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { galleryFilterParams, readGalleryFilters } from "@/lib/gallery-filters";
import type { GalleryFilterOptions, GalleryFilters } from "@/lib/gallery-filters";

type FilterUpdate = Partial<GalleryFilters> | ((current: GalleryFilters) => GalleryFilters);

export function useGalleryFilters(options: GalleryFilterOptions) {
  const params = useSearchParams();
  const urlFilters = useMemo(() => readGalleryFilters(params, options), [params, options]);
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
    const current = { ...readGalleryFilters(new URLSearchParams(window.location.search), options), query };
    const next = typeof update === "function" ? update(current) : { ...current, ...update };
    setDraft((value) => ({ ...value, value: next.query }));
    startTransition(() => {
      setOptimisticFilters(next);
      writeUrl(next, "push");
    });
  }

  function commitQuery(value: string) {
    cancelSearch();
    const current = readGalleryFilters(new URLSearchParams(window.location.search), options);
    writeUrl({ ...current, query: value }, "replace");
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

  return { filters: { ...optimisticFilters, query }, updateFilters, changeQuery, flushQuery };
}
