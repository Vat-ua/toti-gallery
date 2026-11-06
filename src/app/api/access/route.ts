import { AccessError, consumeAccessLink, inspectAccessLink } from "@/lib/access-links";
import { isSameOrigin } from "@/lib/auth";
import { allowAttempt, requestIP } from "@/lib/auth-rate-limit";
import { readJsonBody } from "@/lib/request-body";
import { serverErrorResponse } from "@/lib/server-response";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  try {
    if (!await allowAttempt("access-ip", requestIP(request), 15, 60)) return Response.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    const body = await readJsonBody(request, 2048) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError();
    if (body.action === "inspect") {
      const grant = await inspectAccessLink(body.token);
      return Response.json({ email: grant.email, purpose: grant.purpose, expiresAt: grant.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action !== undefined && body.action !== "consume") throw new AccessError();
    await consumeAccessLink(body.token, body.password, body.confirmPassword);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverErrorResponse(error, "Não foi possível definir a senha. Tente novamente.", "access.redeem");
  }
}
