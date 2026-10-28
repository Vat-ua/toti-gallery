import { IMAGE_MAX_BYTES, validateImageFile } from "./image-policy";

export class ImageFormError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Bound the stream before parsing; Content-Length alone is not trustworthy. */
export async function readImageForm(request: Request) {
  const limit = IMAGE_MAX_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new ImageFormError("Os dados excedem o limite de 3 MB para a imagem.", 413);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new ImageFormError("Os dados excedem o limite de 3 MB para a imagem.", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const buffer = Buffer.concat(chunks);
  const type = request.headers.get("content-type") || "";
  let body: unknown, file: File | null = null;
  try {
    if (type.startsWith("multipart/form-data")) {
      const form = await new Response(buffer, { headers: { "Content-Type": type } }).formData();
      if ([...form.keys()].some(key => !["data", "image"].includes(key)) || form.getAll("data").length !== 1 || form.getAll("image").length > 1) throw new Error();
      const data = form.get("data"), image = form.get("image");
      if (typeof data !== "string") throw new Error();
      body = JSON.parse(data);
      if (image !== null) { if (!(image instanceof File)) throw new Error(); file = image; }
    } else if (type.startsWith("application/json")) body = JSON.parse(buffer.toString("utf8"));
    else throw new Error();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch { throw new ImageFormError("Os dados do formulário são inválidos. Revise e tente novamente."); }
  if (file) validateImageFile(file);
  return { body: body as Record<string, unknown>, file };
}
