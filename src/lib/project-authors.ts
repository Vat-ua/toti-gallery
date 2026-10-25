import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { projectAuthors, users } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function setProjectAuthors(tx: Transaction, projectId: string, ownerId: string, coauthorIds: string[]) {
  const ids = [...new Set([ownerId, ...coauthorIds])];
  const registered = await tx.select({ id: users.id, cohort: users.cohort }).from(users).where(inArray(users.id, ids));
  const owner = registered.find(person => person.id === ownerId);
  if (!owner || registered.length !== ids.length) throw new Error("Selecione apenas pessoas cadastradas como coautoras.");
  if (registered.some(person => person.cohort !== owner.cohort)) throw new Error("Selecione apenas coautores da sua turma.");
  await tx.delete(projectAuthors).where(and(eq(projectAuthors.projectId, projectId), ne(projectAuthors.userId, ownerId)));
  await tx.insert(projectAuthors).values(ids.map((userId) => ({ projectId, userId }))).onConflictDoNothing();
}
