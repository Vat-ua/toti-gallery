import { getCurrentUser } from "@/lib/auth";
import { adminMutation } from "@/lib/admin-http";
import { AdminError } from "@/lib/admin-turmas";
import { createAdministrator, findAdministratorCandidates, promoteAdministrator } from "@/lib/admin-administrators";

export async function GET(request: Request) {
  const actor = await getCurrentUser(), headers = { "Cache-Control": "no-store" };
  if (!actor) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401, headers });
  if (actor.role !== "owner") return Response.json({ error: "Acesso restrito ao proprietário." }, { status: 403, headers });
  try {
    const query = new URL(request.url).searchParams.get("q")?.slice(0, 254) || "";
    return Response.json({ candidates: await findAdministratorCandidates(actor.id, query) }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof AdminError ? error.message : "Não foi possível buscar os perfis." }, { status: error instanceof AdminError ? error.status : 500, headers });
  }
}

export async function POST(request: Request) {
  return adminMutation(request, async (actorId, body) => {
    if (body.action === "create") return createAdministrator(actorId, body.name, body.email);
    if (body.action === "promote") return promoteAdministrator(actorId, body.userId);
    throw new AdminError("Ação inválida.");
  });
}
