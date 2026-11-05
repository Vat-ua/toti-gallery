// Server-side project use cases. actorId must come from a verified session.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectAuthors, projects } from "@/db/schema";
import { FormValidationError } from "./form-validation";
import { validateCoauthorIds, validateProject, validateProjectTurma } from "./validation";
import { getPublicationTurmas } from "./queries";
import { setProjectAuthors } from "./project-authors";
import { allowAttempt } from "./auth-rate-limit";
import { deleteImage, saveImage } from "./image-storage";

export type ProjectSubmission = { body: Record<string, unknown>; file: File | null };
export class ProjectMutationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type UploadedCover = Awaited<ReturnType<typeof saveImage>>;
const ownedBy = (actorId: string, id: string) => and(eq(projects.id, id), eq(projects.authorId, actorId));

/** Object storage cannot join a SQL transaction: compensate only failed commits. */
async function withCoverUpload<T>(actorId: string, file: File | null, commit: (cover: UploadedCover | undefined) => Promise<T>) {
  let uploaded: UploadedCover | undefined;
  try {
    if (file) {
      if (!await allowAttempt("image-upload", actorId, 20, 900)) throw new ProjectMutationError("Muitos envios. Aguarde alguns minutos.", 429);
      uploaded = await saveImage(file, "cover");
    }
    return await commit(uploaded);
  } catch (error) {
    if (uploaded) await deleteImage(uploaded.metadata);
    throw error;
  }
}

export async function createProject(actorId: string, { body, file }: ProjectSubmission) {
  const data = validateProject(body);
  const coauthorIds = validateCoauthorIds(body) ?? [];
  const turmas = await getPublicationTurmas(actorId);
  const turmaId = validateProjectTurma(body.turmaId, turmas.map(turma => turma.id));
  const id = randomUUID();
  const prefix = data.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `${prefix || "projeto"}-${id.slice(0, 8)}`;
  await withCoverUpload(actorId, file, uploaded => db.transaction(async tx => {
    await tx.insert(projects).values({ ...data, imageUrl: uploaded?.url ?? data.imageUrl,
      coverFraming: uploaded || data.imageUrl ? data.coverFraming ?? null : null,
      imageMetadata: uploaded?.metadata ?? null, id, slug, authorId: actorId, turmaId });
    await setProjectAuthors(tx, id, actorId, coauthorIds);
  }));
  return { id, slug };
}

export async function updateProject(actorId: string, id: string, readSubmission: () => Promise<ProjectSubmission>) {
  const owned = ownedBy(actorId, id);
  const [original] = await db.select({ imageUrl: projects.imageUrl, turmaId: projects.turmaId }).from(projects).where(owned).limit(1);
  if (!original) throw new ProjectMutationError("Projeto não encontrado ou sem permissão para editar.", 404);
  // Preserve authorization-before-body-parsing, including oversized/malformed requests.
  // The callback supplies input; this module never reads HTTP requests or headers.
  const { body, file } = await readSubmission();
  if (body.turmaId !== undefined && body.turmaId !== original.turmaId) throw new FormValidationError({ turmaId: "A turma de um projeto publicado não pode ser alterada." });
  const data = validateProject(body, original.imageUrl);
  const coauthorIds = validateCoauthorIds(body);
  return withCoverUpload(actorId, file, uploaded => db.transaction(async tx => {
    const [found] = await tx.select({ slug: projects.slug, imageUrl: projects.imageUrl, metadata: projects.imageMetadata, coverFraming: projects.coverFraming }).from(projects).where(owned).for("update").limit(1);
    if (!found) throw new ProjectMutationError("Projeto não encontrado ou sem permissão para editar.");
    if (!uploaded && data.imageUrl && data.imageUrl === original.imageUrl && data.imageUrl !== found.imageUrl) throw new ProjectMutationError("A capa mudou. Atualize a página e tente novamente.");
    const imageUrl = uploaded?.url ?? data.imageUrl;
    const coverFraming = !imageUrl ? null : data.coverFraming !== undefined ? data.coverFraming : imageUrl === found.imageUrl ? found.coverFraming : null;
    await tx.update(projects).set({ ...data, imageUrl, coverFraming, imageMetadata: uploaded?.metadata ?? (imageUrl === found.imageUrl ? found.metadata : null), updatedAt: new Date() }).where(owned);
    if (coauthorIds !== undefined) await setProjectAuthors(tx, id, actorId, coauthorIds);
    return { slug: found.slug, retired: uploaded || data.imageUrl !== found.imageUrl ? found.metadata : null };
  }));
}

export async function deleteProject(actorId: string, id: string) {
  const owned = ownedBy(actorId, id);
  // Keep the initial 404 and the locked recheck's existing error semantics.
  const [original] = await db.select({ id: projects.id }).from(projects).where(owned).limit(1);
  if (!original) throw new ProjectMutationError("Projeto não encontrado ou sem permissão para editar.", 404);
  return db.transaction(async tx => {
    const [found] = await tx.select({ slug: projects.slug, metadata: projects.imageMetadata }).from(projects).where(owned).for("update").limit(1);
    if (!found) throw new ProjectMutationError("Projeto não encontrado ou sem permissão para editar.");
    await tx.delete(projects).where(owned);
    return { slug: found.slug, retired: found.metadata };
  });
}

export async function leaveProject(actorId: string, id: string) {
  await db.transaction(async tx => {
    const [project] = await tx.select({ ownerId: projects.authorId }).from(projects).where(eq(projects.id, id)).for("update").limit(1);
    if (!project) throw new ProjectMutationError("Projeto não encontrado.", 404);
    if (project.ownerId === actorId) throw new ProjectMutationError("O responsável pela publicação não pode sair do próprio projeto.", 403);
    const removed = await tx.delete(projectAuthors).where(and(eq(projectAuthors.projectId, id), eq(projectAuthors.userId, actorId))).returning({ userId: projectAuthors.userId });
    if (!removed.length) throw new ProjectMutationError("Você não é coautor deste projeto.", 404);
  });
}
