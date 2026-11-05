import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { leaveProject } from "@/lib/project-mutations";
import { projectErrorResponse } from "@/lib/project-http";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
    const { id } = await params;
    await leaveProject(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return projectErrorResponse(error, "Não foi possível sair do projeto.", "project.leave");
  }
}
