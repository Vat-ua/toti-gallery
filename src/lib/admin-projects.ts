import { and, count, desc, eq, inArray, or, sql, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { likes, projectAuthors, projects, turmas, users } from "@/db/schema";
import { AdminError, staff } from "./admin-turmas";
import { ADMIN_PROJECT_PAGE_SIZE, parseAdminProjectFilters, type AdminProjectFilters } from "./admin-project-params";
import type { AdminProject, AdminProjectPage } from "./admin-types";
import type { Person } from "./types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Row = { project: typeof projects.$inferSelect; turmaName: string; year: number | null };
function matches(column: SQLWrapper, query: string) {
  const text = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return sql`strpos(regexp_replace(normalize(lower(${column}), NFD), ${"[\u0300-\u036f]"}, '', 'g'), ${text}) > 0`;
}
async function hydrate(tx: Transaction, rows: Row[]): Promise<AdminProject[]> {
  if (!rows.length) return [];
  const ids = rows.map(row => row.project.id);
  const credits = await tx.select().from(projectAuthors).where(inArray(projectAuthors.projectId, ids));
  const userIds = [...new Set([...rows.flatMap(row => [row.project.authorId, ...(row.project.moderatedBy ? [row.project.moderatedBy] : [])]), ...credits.map(credit => credit.userId)])];
  const people = await tx.select({ id: users.id, name: users.name, bio: users.bio, avatar: users.image, github: users.github }).from(users).where(inArray(users.id, userIds));
  const totals = await tx.select({ id: likes.projectId, total: count() }).from(likes).where(inArray(likes.projectId, ids)).groupBy(likes.projectId);
  const byId = new Map(people.map(person => [person.id, person]));
  return rows.map(({ project, turmaName, year }) => {
    const person = (id: string): Person => ({ ...byId.get(id)!, cohort: turmaName, turmaId: project.turmaId, year: year || 0 });
    const author = person(project.authorId);
    return {
      id: project.id, slug: project.slug, title: project.title, description: project.description,
      technologies: project.technologies, coverStyle: project.coverStyle, imageUrl: project.imageUrl, coverFraming: project.coverFraming,
      githubUrl: project.githubUrl, liveUrl: project.liveUrl, featured: project.featured, isFinal: project.isFinal,
      turmaId: project.turmaId, turmaName, createdAt: project.createdAt.toISOString(), author,
      authors: [author, ...credits.filter(credit => credit.projectId === project.id && credit.userId !== author.id).map(credit => person(credit.userId)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))],
      likes: project.baseLikes + (totals.find(total => total.id === project.id)?.total || 0), liked: false,
      visibility: project.visibility, moderationReason: project.moderationReason,
      moderatedAt: project.moderatedAt?.toISOString() || null,
      moderatedByName: project.moderatedBy ? byId.get(project.moderatedBy)?.name || null : null,
    };
  });
}
export async function listAdminProjects(actorId: string, options: Partial<AdminProjectFilters> = {}): Promise<AdminProjectPage> {
  const filters = parseAdminProjectFilters({ q: options.query, turma: options.turmaId, visibility: options.visibility, page: options.page });
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const search = filters.query ? or(matches(projects.title, filters.query), inArray(projects.authorId, tx.select({ id: users.id }).from(users).where(matches(users.name, filters.query))), inArray(projects.id, tx.select({ id: projectAuthors.projectId }).from(projectAuthors).innerJoin(users, eq(users.id, projectAuthors.userId)).where(matches(users.name, filters.query)))) : undefined;
    const where = and(search, filters.turmaId === "all" ? undefined : eq(projects.turmaId, filters.turmaId), filters.visibility === "all" ? undefined : eq(projects.visibility, filters.visibility));
    const [{ total }] = await tx.select({ total: count() }).from(projects).where(where);
    const page = Math.min(filters.page, Math.max(1, Math.ceil(total / ADMIN_PROJECT_PAGE_SIZE)));
    const rows = await tx.select({ project: projects, turmaName: turmas.name, year: turmas.graduationYear }).from(projects).innerJoin(turmas, eq(turmas.id, projects.turmaId)).where(where).orderBy(desc(projects.createdAt), desc(projects.id)).limit(page * ADMIN_PROJECT_PAGE_SIZE);
    return { projects: await hydrate(tx, rows), total, filters: { ...filters, page } };
  }, { isolationLevel: "repeatable read" });
}
export async function getAdminProject(actorId: string, id: string) {
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const rows = await tx.select({ project: projects, turmaName: turmas.name, year: turmas.graduationYear }).from(projects).innerJoin(turmas, eq(turmas.id, projects.turmaId)).where(eq(projects.id, id)).limit(1);
    return (await hydrate(tx, rows))[0] || null;
  });
}
export async function moderateProject(actorId: string, id: string, action: unknown, expectedVisibility: unknown, reason: unknown) {
  if (action !== "hide" && action !== "restore") throw new AdminError("Ação inválida.");
  if (expectedVisibility !== "published" && expectedVisibility !== "hidden") throw new AdminError("Atualize a página e tente novamente.", 409);
  const text = typeof reason === "string" ? reason.trim() : "";
  if (action === "hide" && (!text || text.length > 1000)) throw new AdminError("Informe o motivo, com até 1.000 caracteres.");
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const [project] = await tx.select({ id: projects.id, visibility: projects.visibility }).from(projects).where(eq(projects.id, id)).for("update").limit(1);
    if (!project) throw new AdminError("Projeto não encontrado.", 404);
    if (project.visibility !== expectedVisibility || (action === "hide" ? project.visibility !== "published" : project.visibility !== "hidden")) throw new AdminError("A situação deste projeto mudou. Atualize a página antes de continuar.", 409);
    const visibility = action === "hide" ? "hidden" : "published";
    await tx.update(projects).set({ visibility, moderationReason: action === "hide" ? text : null, moderatedBy: actorId, moderatedAt: new Date() }).where(eq(projects.id, id));
    return { id, visibility };
  });
}
