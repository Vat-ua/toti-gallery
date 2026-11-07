import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { getPersonBySlug, readProjectPage, type ProjectScope } from "@/lib/queries";
import { readGalleryFilters } from "@/lib/gallery-filters";
import { readImageForm } from "@/lib/image-form";
import { createProject, ProjectCreationConflict } from "@/lib/project-mutations";
import { projectErrorResponse } from "@/lib/project-http";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const view = params.get("view") || "gallery";
    let scope: ProjectScope;
    if (view === "mine") {
      const user = await getCurrentUser();
      if (!user) return Response.json({ error: "Entre na sua conta para ver seus projetos." }, { status: 401 });
      scope = { kind: "mine", userId: user.id };
    } else if (view === "profile") {
      const person = await getPersonBySlug(params.get("slug") || "");
      if (!person) return Response.json({ error: "Perfil não encontrado." }, { status: 404 });
      scope = { kind: "profile", userId: person.id };
    } else if (view === "gallery") scope = { kind: "gallery" };
    else return Response.json({ error: "Lista de projetos inválida." }, { status: 400 });
    return Response.json(await readProjectPage(readGalleryFilters(params, scope.kind === "gallery" ? "gallery" : "page"), scope), { headers: { "Cache-Control": "no-store" } });
  }
  catch (error) { return projectErrorResponse(error, "Não foi possível carregar os projetos.", "project.list"); }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Entre na sua conta para publicar." }, { status: 401 });
    return Response.json(await createProject(user.id, await readImageForm(request)), { status: 201 });
  } catch (error) {
    if (error instanceof ProjectCreationConflict) return Response.json({ error: error.message, projectId: error.projectId }, { status: 409, headers: { "Cache-Control": "no-store" } });
    return projectErrorResponse(error, "Não foi possível publicar o projeto.", "project.create");
  }
}
