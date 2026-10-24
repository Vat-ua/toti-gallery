import { db } from "@/db";
import { users, projects, likes } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { cookies } from "next/headers";
import { ensureSeed } from "./seed";
import type { Project, Person } from "./types";

export async function getProjects(): Promise<Project[]> {
  await ensureSeed();
  const visitor = (await cookies()).get("toti_visitor")?.value;
  const [rows, totals, mine] = await Promise.all([
    db.select({ project: projects, author: { id: users.id, name: users.name, cohort: users.cohort, year: users.year, bio: users.bio, avatar: users.avatar, github: users.github } }).from(projects).innerJoin(users, eq(projects.authorId, users.id)).orderBy(desc(projects.createdAt)),
    db.select({ id: likes.projectId, total: count() }).from(likes).groupBy(likes.projectId),
    visitor ? db.select({ id: likes.projectId }).from(likes).where(eq(likes.visitorKey, visitor)) : Promise.resolve([]),
  ]);
  const totalMap = new Map(totals.map(p => [p.id, p.total]));
  const mineSet = new Set(mine.map(p => p.id));
  return rows.map(({ project, author }) => ({ ...project, author, createdAt: project.createdAt.toISOString(), likes: project.baseLikes + (totalMap.get(project.id) || 0), liked: mineSet.has(project.id) }));
}
export async function getPeople(): Promise<Person[]> {
  await ensureSeed();
  return db.select({ id: users.id, name: users.name, cohort: users.cohort, year: users.year, bio: users.bio, avatar: users.avatar, github: users.github }).from(users).orderBy(users.name);
}
