import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { isSameOrigin } from "@/lib/auth";
import { PublicError } from "@/lib/errors";
import { readJsonBody } from "@/lib/request-body";
import { serverErrorResponse } from "@/lib/server-response";
import { isVisitorId, VISITOR_COOKIE } from "@/lib/visitor-id";

/** Establish identity before any SQL mutation. No account or database access. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
    const body = await readJsonBody(request, 256);
    if (!body || typeof body !== "object" || Array.isArray(body) || ("visitorId" in body && !isVisitorId(body.visitorId))) throw new PublicError("Identificação do navegador inválida.");
    const jar = await cookies();
    const existing = jar.get(VISITOR_COOKIE)?.value;
    // Preserve existing likes when upgrading a browser that already has a cookie.
    const visitorId = isVisitorId(existing) ? existing : "visitorId" in body ? body.visitorId as string : randomUUID();
    jar.set(VISITOR_COOKIE, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return Response.json({ visitorId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return serverErrorResponse(error, "Não foi possível preparar as curtidas. Tente novamente.", "visitor.prepare"); }
}
