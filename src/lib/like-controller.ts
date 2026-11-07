import { LikeRequestError, type LikeState } from "./likes-client";
export type LikeSnapshot = LikeState & { pending: boolean; error: string | null };

/** Coalesce rapid clicks to the latest intent; keep only one write in flight. */
export function createLikeController(initial: LikeState, save: (liked: boolean) => Promise<LikeState>) {
  let confirmed = initial, desired = initial.liked, running = false, revision = 0;
  let snapshot: LikeSnapshot = { liked: initial.liked, likes: initial.likes, pending: false, error: null };
  const listeners = new Set<() => void>();
  function publish(error: string | null = null) {
    snapshot = { liked: desired, likes: confirmed.likes + Number(desired) - Number(confirmed.liked), pending: running, error };
    for (const listener of listeners) listener();
  }
  async function drain() {
    running = true; publish();
    while (desired !== confirmed.liked) {
      const intent = desired, sentRevision = revision;
      try { confirmed = await save(intent); }
      catch (error) {
        if (error instanceof LikeRequestError && error.confirmed) confirmed = error.confirmed;
        // A newer click is processed only after a successful reconciliation.
        if (sentRevision !== revision && error instanceof LikeRequestError && error.confirmed) { publish(); continue; }
        desired = confirmed.liked; running = false;
        publish(error instanceof Error ? error.message : "Não foi possível curtir. Tente novamente."); return;
      }
      publish();
    }
    running = false; publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    toggle() { desired = !desired; revision++; publish(); if (!running) void drain(); },
    refresh(value: LikeState) {
      if (running || (confirmed.observedAt !== undefined && (value.observedAt === undefined || value.observedAt <= confirmed.observedAt))) return;
      const changed = value.liked !== confirmed.liked || value.likes !== confirmed.likes;
      confirmed = value; desired = value.liked;
      if (changed) publish();
    },
  };
}
