import { after } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { readImageForm } from "@/lib/image-form";
import { retireImage } from "@/lib/image-storage";
import { updateProject, deleteProject } from "@/lib/project-mutations";
import { projectErrorResponse } from "@/lib/project-http";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const { id } = await params;
  try {
    const result = await updateProject(user.id, id, () => readImageForm(request));
    if (result.retired) after(() => retireImage(result.retired));
    return Response.json({ ok: true, slug: result.slug });
  } catch (error) { return projectErrorResponse(error, "Não foi possível salvar."); }
}
export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const { id } = await params;
  try {
    const result = await deleteProject(user.id, id);
    if (result.retired) after(() => retireImage(result.retired));
    return Response.json({ ok: true, slug: result.slug });
  } catch (error) { return projectErrorResponse(error, "Não foi possível salvar."); }
}
