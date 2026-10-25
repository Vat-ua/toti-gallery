import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectAuthors, projects } from "@/db/schema";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const { id } = await params;
  return db.transaction(async (tx) => {
    const project = (await tx.select({ ownerId: projects.authorId }).from(projects).where(eq(projects.id, id)).for("update").limit(1))[0];
    if (!project) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
    if (project.ownerId === user.id) return Response.json({ error: "O responsável pela publicação não pode sair do próprio projeto." }, { status: 403 });
    const removed = await tx.delete(projectAuthors)
      .where(and(eq(projectAuthors.projectId, id), eq(projectAuthors.userId, user.id)))
      .returning({ userId: projectAuthors.userId });
    if (!removed.length) return Response.json({ error: "Você não é coautor deste projeto." }, { status: 404 });
    return Response.json({ ok: true });
  });
}
