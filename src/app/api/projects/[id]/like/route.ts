import { cookies } from "next/headers";
import { isSameOrigin } from "@/lib/auth";
import { allowAttempt } from "@/lib/auth-rate-limit";
import { PublicError } from "@/lib/errors";
import { readJsonBody } from "@/lib/request-body";
import { serverErrorResponse } from "@/lib/server-response";
import { readProjectLike, setProjectLike } from "@/lib/project-likes";
import { isVisitorId, VISITOR_COOKIE } from "@/lib/visitor-id";

type Context = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "no-store" };
async function visitor() {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return isVisitorId(value) ? value : null;
}
export async function GET(_request: Request, { params }: Context) {
  try { return Response.json(await readProjectLike((await params).id, await visitor()), { headers }); }
  catch (error) { return serverErrorResponse(error, "Não foi possível consultar a curtida.", "project.like.read"); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403, headers });
    const body = await readJsonBody(request, 256);
    if (!body || typeof body !== "object" || Array.isArray(body) || !("liked" in body) || typeof body.liked !== "boolean") throw new PublicError("Informe se deseja curtir ou descurtir o projeto.");
    const visitorId = await visitor();
    if (!visitorId) throw new PublicError("Permita cookies e atualize a página para curtir.", 409);
    if (!await allowAttempt("project-like", visitorId, 60, 60)) return Response.json({ error: "Muitas curtidas em pouco tempo. Aguarde um minuto e tente novamente." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    return Response.json(await setProjectLike((await params).id, visitorId, body.liked), { headers });
  } catch (error) { return serverErrorResponse(error, "Não foi possível curtir. Tente novamente.", "project.like"); }
}
