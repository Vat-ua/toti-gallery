import { IMAGE_MAX_BYTES, validateImageFile } from "./image-policy";
import { FormValidationError } from "./form-validation";
import { BodyLimitError, readLimitedBody } from "./request-body";

export class ImageFormError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Bound the stream before parsing; Content-Length alone is not trustworthy. */
export async function readImageForm(request: Request, imageField: "imageUrl" | "avatar" = "imageUrl") {
  const limit = IMAGE_MAX_BYTES + 64 * 1024;
  let buffer: Awaited<ReturnType<typeof readLimitedBody>>;
  try { buffer = await readLimitedBody(request, limit); }
  catch (error) {
    if (error instanceof BodyLimitError) throw new ImageFormError("Os dados excedem o limite de 3 MB para a imagem.", 413);
    throw error;
  }
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
  if (file) {
    try { validateImageFile(file); }
    catch (error) { throw new FormValidationError({ [imageField]: error instanceof Error ? error.message : "Use uma imagem JPG, PNG ou WebP." }); }
  }
  return { body: body as Record<string, unknown>, file };
}
