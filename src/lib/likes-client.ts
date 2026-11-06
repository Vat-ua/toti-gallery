import { ensureBrowserVisitor } from "./browser-visitor";
import { HttpError, requestJson } from "./http-client";
export type LikeState = { liked: boolean; likes: number };
export type LikeAction = (id: string, liked: boolean) => Promise<LikeState>;
const fallback = "Não foi possível curtir. Tente novamente.";
function state(data: Record<string, unknown>): LikeState {
  if (typeof data.liked !== "boolean" || typeof data.likes !== "number" || !Number.isSafeInteger(data.likes) || data.likes < 0) throw new Error(fallback);
  return { liked: data.liked, likes: data.likes };
}
export class LikeRequestError extends Error {
  constructor(message: string, public confirmed?: LikeState) { super(message); }
}
export async function readLike(id: string) {
  return state(await requestJson(`/api/projects/${encodeURIComponent(id)}/like`, { method: "GET", cache: "no-store" }, fallback));
}
export async function saveLike(id: string, liked: boolean): Promise<LikeState> {
  await ensureBrowserVisitor();
  try {
    const result = state(await requestJson(`/api/projects/${encodeURIComponent(id)}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liked }) }, fallback));
    if (result.liked !== liked) throw new Error(fallback);
    return result;
  } catch (error) {
    // A lost response is not proof that the write failed. Read before rolling back UI.
    let confirmed: LikeState | undefined;
    if (!(error instanceof HttpError) || error.status >= 500) {
      try { confirmed = await readLike(id); } catch { /* Keep the last confirmed UI state. */ }
      if (confirmed?.liked === liked) return confirmed;
    }
    throw new LikeRequestError(error instanceof Error ? error.message : fallback, confirmed);
  }
}
