import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { validateCoauthorIds, validateProject } from "@/lib/validation";
import { setProjectAuthors } from "@/lib/project-authors";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { return mutate(request, context, false); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, true); }
async function mutate(request: Request, { params }: Context, remove: boolean) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const { id } = await params;
  const owned = and(eq(projects.id, id), eq(projects.authorId, user.id));
  try {
    return await db.transaction(async (tx) => {
      const found = (await tx.select({ slug: projects.slug }).from(projects).where(owned).for("update").limit(1))[0];
      if (!found) return Response.json({ error: "Projeto não encontrado ou sem permissão para editar." }, { status: 404 });
      if (remove) await tx.delete(projects).where(owned);
      else {
        const body = await request.json();
        const data = validateProject(body);
        const coauthorIds = validateCoauthorIds(body);
        await tx.update(projects).set({ ...data, updatedAt: new Date() }).where(owned);
        if (coauthorIds !== undefined) await setProjectAuthors(tx, id, user.id, coauthorIds);
      }
      return Response.json({ ok: true, slug: found.slug });
    });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 }); }
}
