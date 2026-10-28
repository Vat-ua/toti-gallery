import { db } from "@/db";
import { users, projects, likes, projectAuthors, turmaMembers, turmas } from "@/db/schema";
import { and, eq, desc, count, or, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import type { Project, Person } from "./types";

async function peopleRows(includePending = false): Promise<Person[]> {
  const rows = await db.select({ id: users.id, name: users.name, bio: users.bio, avatar: users.image, github: users.github,
    turmaId: turmas.id, cohort: turmas.name, year: turmas.graduationYear })
    .from(users).leftJoin(turmaMembers, eq(turmaMembers.userId, users.id)).leftJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(includePending ? undefined : or(eq(users.emailVerified, true), eq(users.isDemo, true)))
    .orderBy(users.name, turmaMembers.joinedAt, turmas.id);
  const result = new Map<string, Person>();
  // A primary display turma keeps existing UI coherent until the stage 3 multi-turma UI.
  for (const row of rows) if (!result.has(row.id)) result.set(row.id, { ...row, cohort: row.cohort || "Sem turma", year: row.year || 0 });
  return [...result.values()];
}

export async function getPeople() { return peopleRows(); }
export async function getCommunityPeople() {
  return (await getPeople()).filter(person => person.turmaId !== null);
}
export async function getPerson(id: string) { return (await peopleRows()).find(person => person.id === id) || null; }

export async function getPublicationTurmas(userId: string) {
  return db.select({ id: turmas.id, name: turmas.name, number: turmas.number, courseName: turmas.courseName })
    .from(turmaMembers).innerJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(eq(turmaMembers.userId, userId)).orderBy(desc(turmas.number));
}

export async function getCoauthorCandidates(turmaId: string | string[]) {
  const ids = typeof turmaId === "string" ? [turmaId] : turmaId;
  if (!ids.length) return [];
  return db.select({ id: users.id, name: users.name, bio: users.bio, avatar: users.image, github: users.github,
    turmaId: turmas.id, cohort: turmas.name, year: turmas.graduationYear })
    .from(turmaMembers).innerJoin(users, eq(users.id, turmaMembers.userId)).innerJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(and(inArray(turmaMembers.turmaId, ids), eq(users.status, "active"), eq(users.emailVerified, true), eq(users.isDemo, false))).orderBy(users.name)
    .then(rows => rows.map(row => ({ ...row, year: row.year || 0 })));
}

export async function getProjects(options: { participantId?: string } = {}): Promise<Project[]> {
  const visitor = (await cookies()).get("toti_visitor")?.value;
  const publicOrOwn = options.participantId ? or(eq(projects.visibility, "published"), inArray(projects.id, db.select({ id: projectAuthors.projectId }).from(projectAuthors).where(eq(projectAuthors.userId, options.participantId)))) : eq(projects.visibility, "published");
  const [rows, people, totals, mine, memberships] = await Promise.all([
    db.select({ project: projects, cohort: turmas.name }).from(projects).innerJoin(turmas, eq(projects.turmaId, turmas.id)).where(publicOrOwn).orderBy(desc(projects.createdAt)),
    peopleRows(true),
    db.select({ id: likes.projectId, total: count() }).from(likes).groupBy(likes.projectId),
    visitor ? db.select({ id: likes.projectId }).from(likes).where(eq(likes.visitorKey, visitor)) : Promise.resolve([]),
    db.select({ projectId: projectAuthors.projectId, userId: projectAuthors.userId }).from(projectAuthors),
  ]);
  const personById = new Map(people.map(person => [person.id, person]));
  const totalMap = new Map(totals.map(p => [p.id, p.total]));
  const mineSet = new Set(mine.map(p => p.id));
  const authorsByProject = new Map<string, Person[]>();
  for (const { projectId, userId } of memberships) {
    const person = personById.get(userId);
    if (person) authorsByProject.set(projectId, [...(authorsByProject.get(projectId) || []), person]);
  }
  return rows.map(({ project, cohort }) => {
    const author = { ...personById.get(project.authorId)!, cohort };
    // Deliberate public projection: moderation actor/reason and email stay private.
    return {
      id: project.id, slug: project.slug, title: project.title, description: project.description,
      technologies: project.technologies, coverStyle: project.coverStyle, imageUrl: project.imageUrl, coverFraming: project.coverFraming,
      githubUrl: project.githubUrl, liveUrl: project.liveUrl, featured: project.featured,
      isFinal: project.isFinal, turmaId: project.turmaId, author,
      authors: [author, ...(authorsByProject.get(project.id) || []).filter(person => person.id !== author.id).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))],
      createdAt: project.createdAt.toISOString(), likes: project.baseLikes + (totalMap.get(project.id) || 0), liked: mineSet.has(project.id),
      visibility: project.visibility,
      moderationReason: project.visibility === "hidden" && options.participantId === project.authorId ? project.moderationReason : null,
    };
  });
}
