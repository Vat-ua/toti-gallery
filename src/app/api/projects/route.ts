import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { getProjects, getPublicationTurmas } from "@/lib/queries";
import { validateCoauthorIds, validateProject } from "@/lib/validation";
import { setProjectAuthors } from "@/lib/project-authors";
import { ImageFormError, readImageForm } from "@/lib/image-form";
import { deleteImage, saveImage } from "@/lib/image-storage";
import { allowAttempt } from "@/lib/auth-rate-limit";

export async function GET() { return Response.json(await getProjects()); }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para publicar." }, { status: 401 });
  let uploaded: Awaited<ReturnType<typeof saveImage>> | undefined;
  let committed = false;
  try {
    const { body, file } = await readImageForm(request);
    const data = validateProject(body);
    const coauthorIds = validateCoauthorIds(body) ?? [];
    const turmas = await getPublicationTurmas(user.id);
    if (!turmas.length) return Response.json({ error: "Peça à administração para associar sua conta a uma turma antes de publicar." }, { status: 403 });
    const turmaId = body.turmaId === undefined ? turmas[0].id : body.turmaId;
    if (typeof turmaId !== "string" || !turmas.some(turma => turma.id === turmaId)) return Response.json({ error: "Selecione uma turma de que você participa." }, { status: 403 });
    if (file) {
      if (!await allowAttempt("image-upload", user.id, 20, 900)) throw new ImageFormError("Muitos envios. Aguarde alguns minutos.", 429);
      uploaded = await saveImage(file, "cover");
    }
    const id = randomUUID();
    const prefix = data.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${prefix || "projeto"}-${id.slice(0, 8)}`;
    await db.transaction(async (tx) => {
      await tx.insert(projects).values({ ...data, imageUrl: uploaded?.url ?? data.imageUrl,
        coverFraming: uploaded || data.imageUrl ? data.coverFraming ?? null : null,
        imageMetadata: uploaded?.metadata ?? null, id, slug, authorId: user.id, turmaId });
      await setProjectAuthors(tx, id, user.id, coauthorIds);
    });
    committed = true;
    return Response.json({ id, slug }, { status: 201 });
  } catch (error) {
    if (uploaded && !committed) await deleteImage(uploaded.metadata);
    return Response.json({ error: error instanceof Error && !("query" in error) ? error.message : "Não foi possível publicar o projeto." }, { status: error instanceof ImageFormError ? error.status : 400 });
  }
}
