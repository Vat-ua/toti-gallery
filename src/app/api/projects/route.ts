import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { getProjects } from "@/lib/queries";
import { readImageForm } from "@/lib/image-form";
import { createProject } from "@/lib/project-mutations";
import { projectErrorResponse } from "@/lib/project-http";

export async function GET() { return Response.json(await getProjects()); }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para publicar." }, { status: 401 });
  try {
    return Response.json(await createProject(user.id, await readImageForm(request)), { status: 201 });
  } catch (error) { return projectErrorResponse(error, "Não foi possível publicar o projeto."); }
}
