import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { projectAuthors, projects, turmaMembers, users } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function setProjectAuthors(tx: Transaction, projectId: string, ownerId: string, coauthorIds: string[]) {
  const ids = [...new Set([ownerId, ...coauthorIds])];
  const [project] = await tx.select({ turmaId: projects.turmaId }).from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new Error("Projeto não encontrado.");
  const existing = await tx.select({ userId: projectAuthors.userId }).from(projectAuthors).where(eq(projectAuthors.projectId, projectId));
  const existingIds = new Set(existing.map(person => person.userId));
  const added = ids.filter(id => !existingIds.has(id));
  if (added.length) {
    const eligible = await tx.select({ id: users.id }).from(turmaMembers).innerJoin(users, eq(users.id, turmaMembers.userId))
      .where(and(eq(turmaMembers.turmaId, project.turmaId), inArray(users.id, added), eq(users.status, "active"), eq(users.isDemo, false)));
    if (eligible.length !== added.length) throw new Error("Selecione apenas participantes ativos da turma do projeto.");
  }
  await tx.delete(projectAuthors).where(and(eq(projectAuthors.projectId, projectId), ne(projectAuthors.userId, ownerId)));
  await tx.insert(projectAuthors).values(ids.map((userId) => ({ projectId, userId }))).onConflictDoNothing();
}
