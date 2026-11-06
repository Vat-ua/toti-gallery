import { PublicError } from "./errors";

export class BodyLimitError extends Error {}

/** Enforce a byte limit while consuming the stream, even without Content-Length. */
export async function readLimitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new BodyLimitError();
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel().catch(() => undefined); throw new BodyLimitError(); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  return Buffer.concat(chunks);
}

export async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  const bytes = await readLimitedBody(request, limit);
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new PublicError("Dados inválidos. Revise o formulário e tente novamente."); }
}
