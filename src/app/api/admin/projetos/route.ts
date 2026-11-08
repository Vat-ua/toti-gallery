import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { readAdminProjectFilters } from "@/lib/admin-project-params";
import { readAdminProjectPage } from "@/lib/admin-projects";
import { serverErrorResponse } from "@/lib/server-response";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const actor = await getCurrentUser();
    if (!actor) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401, headers });
    if (!isStaff(actor.role)) return Response.json({ error: "Acesso restrito à administração." }, { status: 403, headers });
    return Response.json(await readAdminProjectPage(actor.id, readAdminProjectFilters(new URL(request.url).searchParams)), { headers });
  } catch (error) { return serverErrorResponse(error, "Não foi possível carregar os projetos.", "admin.projetos.list"); }
}
