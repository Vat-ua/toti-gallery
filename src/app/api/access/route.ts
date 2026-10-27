import { AccessError, consumeAccessLink, inspectAccessLink } from "@/lib/access-links";
import { isSameOrigin } from "@/lib/auth";
import { allowAttempt, requestIP } from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  if (!await allowAttempt("access-ip", requestIP(request), 15, 60)) return Response.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429, headers: { "Retry-After": "60" } });
  try {
    const text = await request.text();
    if (text.length > 2048) return Response.json({ error: "Dados inválidos." }, { status: 400 });
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError();
    if (body.action === "inspect") {
      const grant = await inspectAccessLink(body.token);
      return Response.json({ email: grant.email, purpose: grant.purpose, expiresAt: grant.expiresAt }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action !== undefined && body.action !== "consume") throw new AccessError();
    await consumeAccessLink(body.token, body.password, body.confirmPassword);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof AccessError ? error.message : error instanceof SyntaxError ? "Dados inválidos." : "Não foi possível definir a senha. Tente novamente." }, { status: error instanceof AccessError || error instanceof SyntaxError ? 400 : 500, headers: { "Cache-Control": "no-store" } });
  }
}
