import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { likes, projects } from "@/db/schema";
import { PublicError } from "./errors";

type Connection = Pick<typeof db, "select">;
async function readSnapshot(connection: Connection, projectId: string, visitorId: string | null) {
  // One SQL snapshot for state and count, including the existing demo base count.
  const [state] = await connection.select({
    observedAt: sql<number>`(extract(epoch from statement_timestamp()) * 1000000)::bigint`.mapWith(Number),
    liked: sql<boolean>`exists(select 1 from ${likes} where ${likes.projectId} = ${projects.id} and ${likes.visitorKey} = ${visitorId || ""})`,
    likes: sql<number>`${projects.baseLikes} + (select count(*)::int from ${likes} where ${likes.projectId} = ${projects.id})`,
  }).from(projects).where(and(eq(projects.id, projectId), eq(projects.visibility, "published"))).limit(1);
  if (!state) throw new PublicError("Projeto não encontrado.", 404);
  return state;
}

export async function readProjectLike(projectId: string, visitorId: string | null) {
  return db.transaction(async tx => {
    // Reconciliation must wait for a write already in progress, then take a fresh snapshot.
    const [project] = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.visibility, "published"))).for("share").limit(1);
    if (!project) throw new PublicError("Projeto não encontrado.", 404);
    return readSnapshot(tx, projectId, visitorId);
  });
}

export async function setProjectLike(projectId: string, visitorId: string, liked: boolean) {
  return db.transaction(async tx => {
    // Serialize changes to this project's counter, also coordinating with hide/delete.
    const [project] = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.visibility, "published"))).for("update").limit(1);
    if (!project) throw new PublicError("Projeto não encontrado.", 404);
    if (liked) await tx.insert(likes).values({ projectId, visitorKey: visitorId }).onConflictDoNothing();
    else await tx.delete(likes).where(and(eq(likes.projectId, projectId), eq(likes.visitorKey, visitorId)));
    return readSnapshot(tx, projectId, visitorId);
  });
}
