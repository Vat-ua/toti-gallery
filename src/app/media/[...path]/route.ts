import { getImage } from "@/lib/image-storage";

import { logServerError } from "@/lib/server-log";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try {
    const object = await getImage(path.join("/"));
    if (!object?.body) return new Response(null, { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable", ...(object.etag ? { ETag: object.etag } : {}),
      ...(object.length !== undefined ? { "Content-Length": String(object.length) } : {}) } });
  } catch (error) {
    const requestId = logServerError("image.read.failed", error, { status: 503 });
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId, "Retry-After": "5" } });
  }
}
