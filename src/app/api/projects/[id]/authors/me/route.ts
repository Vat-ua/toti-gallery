import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { leaveProject, ProjectMutationError } from "@/lib/project-mutations";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { id } = await params;
  try {
    await leaveProject(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ProjectMutationError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
