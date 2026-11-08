import { and, count, desc, eq, inArray, or, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { projectAuthors, projects, turmas, users } from "@/db/schema";
import { AdminError, staff } from "./admin-server";
import { parseAdminProjectFilters, type AdminProjectFilters } from "./admin-project-params";
import { COLLECTION_PAGE_SIZE, collectionPage, initialCollectionPage, requestedPage, collectionSnapshot } from "./collection-page";
import type { AdminProject, AdminProjectPage } from "./admin-types";
import type { Person } from "./types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
function matches(column: SQLWrapper, query: string) {
  const text = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return sql`strpos(regexp_replace(normalize(lower(${column}), NFD), ${"[\u0300-\u036f]"}, '', 'g'), ${text}) > 0`;
}
const cardFields = {
  id: projects.id, slug: projects.slug, title: projects.title, technologies: projects.technologies,
  coverStyle: projects.coverStyle, imageUrl: projects.imageUrl, coverFraming: projects.coverFraming,
  featured: projects.featured, isFinal: projects.isFinal, turmaId: projects.turmaId,
  authorId: projects.authorId, createdAt: projects.createdAt, visibility: projects.visibility,
  moderationReason: projects.moderationReason,
};
type Credit = Pick<Person, "id" | "slug" | "name" | "avatar"> & Partial<Pick<Person, "bio" | "github" | "linkedin">>;
// Correlated indexed reads apply to the selected publications, not the full gallery.
const creditRecords = (detail: boolean) => sql<Credit[]>`(select jsonb_agg(jsonb_build_object('id', u.id, 'slug', u.slug, 'name', u.name, 'avatar', u.avatar) ${detail ? sql`|| jsonb_build_object('bio', u.bio, 'github', u.github, 'linkedin', u.linkedin)` : sql``})
  from (select ${projects.authorId} as user_id union select a.user_id from gallery_project_authors a where a.project_id=${projects.id}) credits
  join gallery_users u on u.id=credits.user_id)`;
async function projectRows<T extends typeof cardFields>(tx: Transaction, fields: T, where: SQL | undefined, limit: number, offset = 0, detail = false) {
  return tx.select({ project: fields, turmaName: turmas.name, year: turmas.graduationYear,
    credits: creditRecords(detail), likes: sql<number>`${projects.baseLikes} + (select count(*) from gallery_likes l where l.project_id=${projects.id})`.mapWith(Number),
    total: sql<number>`count(*) over()`.mapWith(Number),
  }).from(projects).innerJoin(turmas, eq(turmas.id, projects.turmaId)).where(where)
    .orderBy(desc(projects.createdAt), desc(projects.id)).limit(limit).offset(offset);
}
function hydrate<T extends { id: string; authorId: string; turmaId: string; createdAt: Date }>(rows: { project: T; turmaName: string; year: number | null; credits: Credit[]; likes: number }[]) {
  return rows.map(({ project, turmaName, year, credits, likes }) => {
    const { authorId, createdAt, ...values } = project;
    const people: Person[] = credits.map(person => ({ ...person, bio: person.bio || "", github: person.github || null, linkedin: person.linkedin || null,
      cohort: turmaName, cohorts: [turmaName], courseName: null, turmaId: project.turmaId, year: year || 0 }));
    const author = people.find(person => person.id === authorId)!;
    return { ...values, turmaName, author, authors: [author, ...people.filter(person => person.id !== authorId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))],
      createdAt: createdAt.toISOString(), likes, liked: false };
  });
}
async function projectCollection(actorId: string, options: Partial<AdminProjectFilters>, initial: boolean) {
  const filters = parseAdminProjectFilters({ q: options.query, turma: options.turmaId, visibility: options.visibility, page: options.page });
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const search = filters.query ? or(matches(projects.title, filters.query), inArray(projects.authorId, tx.select({ id: users.id }).from(users).where(matches(users.name, filters.query))), inArray(projects.id, tx.select({ id: projectAuthors.projectId }).from(projectAuthors).innerJoin(users, eq(users.id, projectAuthors.userId)).where(matches(users.name, filters.query)))) : undefined;
    const where = and(search, filters.turmaId === "all" ? undefined : eq(projects.turmaId, filters.turmaId), filters.visibility === "all" ? undefined : eq(projects.visibility, filters.visibility));
    let page = initial ? initialCollectionPage(filters.page) : requestedPage(filters.page);
    const read = () => projectRows(tx, cardFields, where, initial ? page * COLLECTION_PAGE_SIZE : COLLECTION_PAGE_SIZE + Number(page > 1), initial ? 0 : Math.max(0, (page - 1) * COLLECTION_PAGE_SIZE - 1));
    let rows = await read(), total = rows[0]?.total || 0;
    if (!initial && (page > collectionPage(page, total) || (!rows.length && page > 1))) {
      if (!rows.length) [{ total }] = await tx.select({ total: count() }).from(projects).where(where);
      page = collectionPage(page, total);
      if (total) rows = await read();
    }
    page = collectionPage(page, total);
    const previousId = !initial && page > 1 ? rows.shift()?.project.id || null : null;
    return { batch: { items: hydrate(rows), total, page, pageSize: COLLECTION_PAGE_SIZE, hasMore: page * COLLECTION_PAGE_SIZE < total, previousId },
      filters: { ...filters, page: collectionPage(filters.page, total) } };
  }, { isolationLevel: "repeatable read" });
}
/** SSR restores a bounded prefix; browser requests return one adjacent batch. */
export async function listAdminProjects(actorId: string, options: Partial<AdminProjectFilters> = {}): Promise<AdminProjectPage> {
  const { batch, filters } = await projectCollection(actorId, options, true);
  return { ...collectionSnapshot(batch), filters };
}
export async function readAdminProjectPage(actorId: string, options: Partial<AdminProjectFilters> = {}) {
  return (await projectCollection(actorId, options, false)).batch;
}
export async function getAdminProject(actorId: string, id: string): Promise<AdminProject | null> {
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const fields = { ...cardFields, version: projects.version, description: projects.description,
      githubUrl: projects.githubUrl, liveUrl: projects.liveUrl, moderatedAt: projects.moderatedAt,
      moderatedByName: sql<string | null>`(select u.name from gallery_users u where u.id=${projects.moderatedBy})` };
    const [row] = hydrate(await projectRows(tx, fields, eq(projects.id, id), 1, 0, true));
    return row ? { ...row, moderatedAt: row.moderatedAt?.toISOString() || null } : null;
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
