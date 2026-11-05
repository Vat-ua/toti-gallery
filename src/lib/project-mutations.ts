// Server-side project use cases. actorId must come from a verified session.
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projectAuthors, projectCreations, projects } from "@/db/schema";
import { FormValidationError } from "./form-validation";
import { validateCoauthorIds, validateProject, validateProjectTurma } from "./validation";
import { getPublicationTurmas } from "./queries";
import { setProjectAuthors } from "./project-authors";
import { allowAttempt } from "./auth-rate-limit";
import { retireImage, saveImage } from "./image-storage";
import { PublicError } from "./errors";
import { commitImageChange } from "./image-transaction";
import { creationRequestId, expectedProjectVersion } from "./project-save-input";

export type ProjectSubmission = { body: Record<string, unknown>; file: File | null };
export class ProjectMutationError extends PublicError {}
export class ProjectCreationConflict extends PublicError {
  constructor(public projectId: string) {
    super("Esta tentativa já publicou um projeto com outros dados. Confira a publicação antes de continuar; suas alterações permanecem neste formulário.", 409);
  }
}
type UploadedCover = Awaited<ReturnType<typeof saveImage>>;
const ownedBy = (actorId: string, id: string) => and(eq(projects.id, id), eq(projects.authorId, actorId));

/** Image commit/rollback handling is shared with profile updates. */
async function withCoverUpload<T>(actorId: string, file: File | null, commit: (cover: UploadedCover | undefined) => Promise<T>) {
  let uploaded: UploadedCover | undefined;
  if (file) {
    if (!await allowAttempt("image-upload", actorId, 20, 900)) throw new ProjectMutationError("Muitos envios. Aguarde alguns minutos.", 429);
    uploaded = await saveImage(file, "cover");
  }
  return await commit(uploaded);
}

export async function createProject(actorId: string, { body, file }: ProjectSubmission) {
  const requestId = creationRequestId(body.requestId);
  const data = validateProject(body);
  const coauthorIds = validateCoauthorIds(body) ?? [];
  const image = file ? { type: file.type, hash: createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex") } : null;
  const digest = createHash("sha256").update(JSON.stringify({ ...data, coauthorIds: [...coauthorIds].sort(), turmaId: body.turmaId ?? null, image })).digest("hex");
  const key = and(eq(projectCreations.authorId, actorId), eq(projectCreations.requestId, requestId));
  type Connection = Pick<typeof db, "select">;
  async function replay(connection: Connection, receipt: typeof projectCreations.$inferSelect) {
    const [existing] = await connection.select({ id: projects.id, slug: projects.slug }).from(projects).where(ownedBy(actorId, receipt.projectId)).limit(1);
    if (!existing) throw new ProjectMutationError("Esta publicação foi excluída. Abra um novo formulário para publicar outro projeto.", 410);
    if (receipt.fingerprint !== digest) throw new ProjectCreationConflict(existing.id);
    return existing;
  }
  // Avoid re-uploading on an ordinary retry. The transaction below closes the race.
  const [receipt] = await db.select().from(projectCreations).where(key).limit(1);
  if (receipt) return replay(db, receipt);
  const turmas = await getPublicationTurmas(actorId);
  const turmaId = validateProjectTurma(body.turmaId, turmas.map(turma => turma.id));
  const id = randomUUID();
  const prefix = data.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `${prefix || "projeto"}-${id.slice(0, 8)}`;
  return withCoverUpload(actorId, file, async uploaded => {
    let duplicate = false;
    const result = await commitImageChange(uploaded?.metadata, async tx => {
      const inserted = await tx.insert(projectCreations).values({ authorId: actorId, requestId, fingerprint: digest, projectId: id, slug }).onConflictDoNothing().returning();
      if (!inserted.length) {
        const [existing] = await tx.select().from(projectCreations).where(key).limit(1);
        duplicate = true;
        return replay(tx, existing);
      }
      await tx.insert(projects).values({ ...data, imageUrl: uploaded?.url ?? data.imageUrl,
        coverFraming: uploaded || data.imageUrl ? data.coverFraming ?? null : null,
        imageMetadata: uploaded?.metadata ?? null, id, slug, authorId: actorId, turmaId });
      await setProjectAuthors(tx, id, actorId, coauthorIds);
      return { id, slug };
    });
    // Concurrent first requests may both upload before acquiring the receipt.
    // Only the winner is referenced. Retire a redundant upload after confirmed COMMIT.
    if (duplicate && uploaded) await retireImage(uploaded.metadata);
    return result;
  });
}

export async function updateProject(actorId: string, id: string, readSubmission: () => Promise<ProjectSubmission>) {
  const owned = ownedBy(actorId, id);
  const [original] = await db.select({ imageUrl: projects.imageUrl, turmaId: projects.turmaId, version: projects.version }).from(projects).where(owned).limit(1);
  if (!original) throw new ProjectMutationError("Projeto não encontrado ou sem permissão para editar.", 404);
  // Preserve authorization-before-body-parsing, including oversized/malformed requests.
  // The callback supplies input; this module never reads HTTP requests or headers.
  const { body, file } = await readSubmission();
  const expected = expectedProjectVersion(body.expectedVersion);
  const conflict = () => new ProjectMutationError("O projeto foi alterado em outra aba ou por um coautor. Confira a versão atual antes de salvar novamente. Suas alterações permanecem neste formulário.", 409);
  if (expected !== original.version) throw conflict();
  if (body.turmaId !== undefined && body.turmaId !== original.turmaId) throw new FormValidationError({ turmaId: "A turma de um projeto publicado não pode ser alterada." });
  const data = validateProject(body, original.imageUrl);
  const coauthorIds = validateCoauthorIds(body);
  return withCoverUpload(actorId, file, uploaded => commitImageChange(uploaded?.metadata, async tx => {
    const [found] = await tx.select({ slug: projects.slug, imageUrl: projects.imageUrl, metadata: projects.imageMetadata, coverFraming: projects.coverFraming, version: projects.version }).from(projects).where(owned).for("update").limit(1);
    if (!found) throw new ProjectMutationError("Projeto não encontrado ou sem permissão para editar.");
    if (expected !== found.version) throw conflict();
    if (!uploaded && data.imageUrl && data.imageUrl === original.imageUrl && data.imageUrl !== found.imageUrl) throw new ProjectMutationError("A capa mudou. Atualize a página e tente novamente.");
    const imageUrl = uploaded?.url ?? data.imageUrl;
    const coverFraming = !imageUrl ? null : data.coverFraming !== undefined ? data.coverFraming : imageUrl === found.imageUrl ? found.coverFraming : null;
    await tx.update(projects).set({ ...data, imageUrl, coverFraming, imageMetadata: uploaded?.metadata ?? (imageUrl === found.imageUrl ? found.metadata : null), version: sql`${projects.version} + 1`, updatedAt: new Date() }).where(owned);
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
    await tx.update(projects).set({ version: sql`${projects.version} + 1`, updatedAt: new Date() }).where(eq(projects.id, id));
  });
}
