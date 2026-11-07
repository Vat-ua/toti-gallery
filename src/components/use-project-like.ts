"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createLikeController, type LikeSnapshot } from "@/lib/like-controller";
import { saveLike, type LikeAction } from "@/lib/likes-client";

const controllers = new Map<string, ReturnType<typeof createLikeController>>();
// Injected persistence has its own controller scope, separate from public likes.
const actionControllers = new WeakMap<LikeAction, typeof controllers>();
export function useProjectLike(id: string, initialLiked: boolean, initialLikes: number, action?: LikeAction, observedAt?: number) {
  const initial = useMemo<LikeSnapshot>(() => ({ liked: initialLiked, likes: initialLikes, observedAt, pending: false, error: null }), [initialLiked, initialLikes, observedAt]);
  const controller = useCallback(() => {
    let scope = controllers;
    if (action) {
      let existing = actionControllers.get(action);
      if (!existing) { existing = new Map(); actionControllers.set(action, existing); }
      scope = existing;
    }
    let value = scope.get(id);
    if (!value) { value = createLikeController(initial, liked => (action ?? saveLike)(id, liked)); scope.set(id, value); }
    return value;
  }, [id, initial, action]);
  const subscribe = useCallback((listener: () => void) => controller().subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller().getSnapshot(), [controller]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  // SQL observation times order fresh API/RSC snapshots and delayed prefetches.
  // Demo snapshots are local and remain scoped to their injected action.
  useEffect(() => { controller().refresh(initial); }, [controller, initial]);
  return { ...snapshot, toggle: () => controller().toggle() };
}
