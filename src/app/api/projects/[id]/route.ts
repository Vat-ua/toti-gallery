import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { validateProject } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { return mutate(request, context, false); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, true); }
async function mutate(request: Request, { params }: Context, remove: boolean) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const { id } = await params;
  const owned = and(eq(projects.id, id), eq(projects.authorId, user.id));
  const found = (await db.select({ slug: projects.slug }).from(projects).where(owned).limit(1))[0];
  if (!found) return Response.json({ error: "Projeto não encontrado ou sem permissão para editar." }, { status: 404 });
  try {
    if (remove) await db.delete(projects).where(owned);
    else await db.update(projects).set({ ...validateProject(await request.json()), updatedAt: new Date() }).where(owned);
    return Response.json({ ok: true, slug: found.slug });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 }); }
}
