"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createLikeController, type LikeSnapshot } from "@/lib/like-controller";
import { saveLike } from "@/lib/likes-client";

const controllers = new Map<string, ReturnType<typeof createLikeController>>();
export function useProjectLike(id: string, initialLiked: boolean, initialLikes: number) {
  const initial = useMemo<LikeSnapshot>(() => ({ liked: initialLiked, likes: initialLikes, pending: false, error: null }), [initialLiked, initialLikes]);
  const controller = useCallback(() => {
    let value = controllers.get(id);
    if (!value) { value = createLikeController(initial, liked => saveLike(id, liked)); controllers.set(id, value); }
    return value;
  }, [id, initial]);
  const subscribe = useCallback((listener: () => void) => controller().subscribe(listener), [controller]);
  const getSnapshot = useCallback(() => controller().getSnapshot(), [controller]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => initial);
  // A genuine server-prop refresh can update an idle controller, without an effect setState.
  useEffect(() => { controller().refresh(initial); }, [controller, initial]);
  return { ...snapshot, toggle: () => controller().toggle() };
}
