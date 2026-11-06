"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createLikeController, type LikeSnapshot } from "@/lib/like-controller";
import { saveLike, type LikeAction } from "@/lib/likes-client";

const controllers = new Map<string, ReturnType<typeof createLikeController>>();
// Injected persistence has its own controller scope, separate from public likes.
const actionControllers = new WeakMap<LikeAction, typeof controllers>();
export function useProjectLike(id: string, initialLiked: boolean, initialLikes: number, action?: LikeAction) {
  const initial = useMemo<LikeSnapshot>(() => ({ liked: initialLiked, likes: initialLikes, pending: false, error: null }), [initialLiked, initialLikes]);
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
  // A genuine server-prop refresh can update an idle controller, without an effect setState.
  useEffect(() => { controller().refresh(initial); }, [controller, initial]);
  return { ...snapshot, toggle: () => controller().toggle() };
}
