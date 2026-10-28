import { after } from "next/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { validateCoauthorIds, validateProject } from "@/lib/validation";
import { setProjectAuthors } from "@/lib/project-authors";
import { ImageFormError, readImageForm } from "@/lib/image-form";
import { deleteImage, retireImage, saveImage } from "@/lib/image-storage";
import { allowAttempt } from "@/lib/auth-rate-limit";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { return mutate(request, context, false); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, true); }
async function mutate(request: Request, { params }: Context, remove: boolean) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const { id } = await params;
  const owned = and(eq(projects.id, id), eq(projects.authorId, user.id));
  let uploaded: Awaited<ReturnType<typeof saveImage>> | undefined;
  let committed = false;
  try {
    const [original] = await db.select({ imageUrl: projects.imageUrl, turmaId: projects.turmaId }).from(projects).where(owned).limit(1);
    if (!original) return Response.json({ error: "Projeto não encontrado ou sem permissão para editar." }, { status: 404 });
    const form = remove ? null : await readImageForm(request);
    if (form && form.body.turmaId !== undefined && form.body.turmaId !== original.turmaId) throw new Error("A turma de um projeto publicado não pode ser alterada.");
    const data = form ? validateProject(form.body, original.imageUrl) : null;
    const coauthorIds = form ? validateCoauthorIds(form.body) : undefined;
    if (form?.file) {
      if (!await allowAttempt("image-upload", user.id, 20, 900)) throw new ImageFormError("Muitos envios. Aguarde alguns minutos.", 429);
      uploaded = await saveImage(form.file, "cover");
    }
    const result = await db.transaction(async (tx) => {
      const [found] = await tx.select({ slug: projects.slug, imageUrl: projects.imageUrl, metadata: projects.imageMetadata, coverFraming: projects.coverFraming }).from(projects).where(owned).for("update").limit(1);
      if (!found) throw new Error("Projeto não encontrado ou sem permissão para editar.");
      if (remove) await tx.delete(projects).where(owned);
      else if (data) {
        if (!uploaded && data.imageUrl && data.imageUrl === original.imageUrl && data.imageUrl !== found.imageUrl) throw new Error("A capa mudou. Atualize a página e tente novamente.");
        const imageUrl = uploaded?.url ?? data.imageUrl;
        const coverFraming = !imageUrl ? null : data.coverFraming !== undefined ? data.coverFraming : imageUrl === found.imageUrl ? found.coverFraming : null;
        await tx.update(projects).set({ ...data, imageUrl, coverFraming, imageMetadata: uploaded?.metadata ?? (imageUrl === found.imageUrl ? found.metadata : null), updatedAt: new Date() }).where(owned);
        if (coauthorIds !== undefined) await setProjectAuthors(tx, id, user.id, coauthorIds);
      }
      return { slug: found.slug, retired: remove || uploaded || data?.imageUrl !== found.imageUrl ? found.metadata : null };
    });
    committed = true;
    if (result.retired) after(() => retireImage(result.retired));
    return Response.json({ ok: true, slug: result.slug });
  } catch (error) {
    if (uploaded && !committed) await deleteImage(uploaded.metadata);
    return Response.json({ error: error instanceof Error && !("query" in error) ? error.message : "Não foi possível salvar." }, { status: error instanceof ImageFormError ? error.status : 400 });
  }
}
