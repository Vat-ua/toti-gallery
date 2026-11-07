import { db } from "@/db";
import { users, projects, likes, projectAuthors, turmaMembers, turmas } from "@/db/schema";
import { and, eq, desc, count, or, inArray, sql, ne, type SQL, type SQLWrapper } from "drizzle-orm";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Project, ProjectSummary, Person, CommunityPerson } from "./types";
import type { GalleryFilters, GalleryFilterOptions } from "./gallery-filters";
import { COLLECTION_PAGE_SIZE, collectionPage, initialCollectionPage, requestedPage, collectionSnapshot, type CollectionPage, type CollectionSnapshot } from "./collection-page";

type ReadConnection = Pick<typeof db, "select" | "execute">;

const personFields = { id: users.id, slug: users.slug, name: users.name, bio: users.bio, avatar: users.image, github: users.github, linkedin: users.linkedin, primaryTurmaId: users.primaryTurmaId };
type ProfileRow = Omit<Person, "turmaId" | "cohort" | "cohorts" | "courseName" | "year"> & { primaryTurmaId: string | null };
type ProfileTurma = { id: string; name: string; courseName: string | null; startYear: number | null };

function publicPerson({ primaryTurmaId, ...person }: ProfileRow, groups: ProfileTurma[]): Person {
  const primary = groups.find(group => group.id === primaryTurmaId) || groups[0];
  return { ...person, turmaId: primary?.id || null, cohort: primary?.name || "Sem turma",
    cohorts: groups.map(group => group.name), courseName: primary?.courseName || null, year: primary?.startYear || 0 };
}

async function peopleRows(includePending = false, connection: Pick<typeof db, "select"> = db, ids?: string[]): Promise<Person[]> {
  if (ids && !ids.length) return [];
  const rows = await connection.select({ person: personFields, turma: {
    id: turmas.id, name: turmas.name, courseName: turmas.courseName, startYear: turmas.startYear,
  } }).from(users).leftJoin(turmaMembers, eq(turmaMembers.userId, users.id)).leftJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(and(includePending ? undefined : or(eq(users.emailVerified, true), eq(users.isDemo, true)), ids ? inArray(users.id, ids) : undefined))
    .orderBy(users.name, users.id, desc(turmas.number));
  const people = new Map<string, { person: ProfileRow; groups: ProfileTurma[] }>();
  for (const row of rows) {
    const value = people.get(row.person.id) || { person: row.person, groups: [] };
    if (row.turma) value.groups.push(row.turma);
    people.set(row.person.id, value);
  }
  return [...people.values()].map(({ person, groups }) => publicPerson(person, groups));
}

async function findPerson(where: SQL, connection: Pick<typeof db, "select">): Promise<Person | null> {
  // Fetch only this person's memberships in one round trip, including no-turma profiles.
  const rows = await connection.select({ person: personFields, turma: {
    id: turmas.id, name: turmas.name, courseName: turmas.courseName, startYear: turmas.startYear,
  } }).from(users)
    .leftJoin(turmaMembers, eq(turmaMembers.userId, users.id))
    .leftJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(and(where, or(eq(users.emailVerified, true), eq(users.isDemo, true))))
    .orderBy(desc(turmas.number));
  if (!rows.length) return null;
  return publicPerson(rows[0].person, rows.flatMap(row => row.turma ? [row.turma] : []));
}

export async function getPeople() { return peopleRows(); }
export async function getCommunityPeople() {
  return (await getPeople()).filter(person => person.turmaId !== null);
}
export async function getPerson(id: string, connection: Pick<typeof db, "select"> = db) { return findPerson(eq(users.id, id), connection); }
/** Private identity projection: permission checks and memberships share one live read. */
export async function getActiveAccountPerson(id: string, connection: Pick<typeof db, "select"> = db) {
  const rows = await connection.select({ person: personFields, role: users.role, turma: {
    id: turmas.id, name: turmas.name, courseName: turmas.courseName, startYear: turmas.startYear,
  } }).from(users).leftJoin(turmaMembers, eq(turmaMembers.userId, users.id)).leftJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(and(eq(users.id, id), eq(users.status, "active"), eq(users.emailVerified, true), eq(users.isDemo, false)))
    .orderBy(desc(turmas.number));
  if (!rows.length) return null;
  return { ...publicPerson(rows[0].person, rows.flatMap(row => row.turma ? [row.turma] : [])), role: rows[0].role };
}
export const getPersonBySlug = cache(async (slug: string, connection: Pick<typeof db, "select"> = db) => findPerson(eq(users.slug, slug), connection));

/** Public discovery only; no visitor cookies, private fields or membership duplicates. */
export async function getSitemapRecords(connection: Pick<typeof db, "select"> = db) {
  const [publicProjects, communityProfiles] = await Promise.all([
    connection.select({ slug: projects.slug, updatedAt: projects.updatedAt }).from(projects)
      .where(eq(projects.visibility, "published")).orderBy(projects.slug),
    connection.select({ slug: users.slug }).from(users)
      .where(and(
        or(eq(users.emailVerified, true), eq(users.isDemo, true)),
        inArray(users.id, connection.select({ userId: turmaMembers.userId }).from(turmaMembers)),
      )).orderBy(users.slug),
  ]);
  return { projects: publicProjects, people: communityProfiles };
}

export async function getPublicationTurmas(userId: string) {
  return db.select({ id: turmas.id, name: turmas.name, number: turmas.number, courseName: turmas.courseName })
    .from(turmaMembers).innerJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(eq(turmaMembers.userId, userId)).orderBy(desc(turmas.number));
}

export async function getCoauthorCandidates(turmaId: string | string[]) {
  const ids = typeof turmaId === "string" ? [turmaId] : turmaId;
  if (!ids.length) return [];
  return coauthorRows(inArray(turmaMembers.turmaId, ids));
}

export function getPublicationPeople(userId: string) {
  return coauthorRows(inArray(turmaMembers.turmaId,
    db.select({ turmaId: turmaMembers.turmaId }).from(turmaMembers).where(eq(turmaMembers.userId, userId))));
}

function coauthorRows(membership: SQL) {
  return db.select({ id: users.id, slug: users.slug, name: users.name, bio: users.bio, avatar: users.image, github: users.github, linkedin: users.linkedin,
    turmaId: turmas.id, cohort: turmas.name, courseName: turmas.courseName, year: turmas.startYear })
    .from(turmaMembers).innerJoin(users, eq(users.id, turmaMembers.userId)).innerJoin(turmas, eq(turmas.id, turmaMembers.turmaId))
    .where(and(membership, eq(users.status, "active"), eq(users.emailVerified, true), eq(users.isDemo, false))).orderBy(users.name)
    .then(rows => rows.map(row => ({ ...row, cohorts: [row.cohort], year: row.year || 0 })));
}

// This explicit projection omits storage metadata, moderation actors and account data.
const cardFields = {
  id: projects.id, slug: projects.slug, title: projects.title,
  technologies: projects.technologies, coverStyle: projects.coverStyle,
  imageUrl: projects.imageUrl, coverFraming: projects.coverFraming, featured: projects.featured, isFinal: projects.isFinal, turmaId: projects.turmaId,
  authorId: projects.authorId, createdAt: projects.createdAt, visibility: projects.visibility,
};
const projectFields = { ...cardFields, version: projects.version, description: projects.description, githubUrl: projects.githubUrl, liveUrl: projects.liveUrl };
const likeTotal = sql<number>`${projects.baseLikes} + (select count(*) from gallery_likes l where l.project_id = ${projects.id})`.mapWith(Number);
function participant(userId: string) {
  return or(eq(projects.authorId, userId), inArray(projects.id, db.select({ id: projectAuthors.projectId }).from(projectAuthors).where(eq(projectAuthors.userId, userId))))!;
}
function matchesText(column: SQLWrapper, query: string) {
  const text = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return sql`strpos(regexp_replace(normalize(lower(${column}), NFD), ${"[\u0300-\u036f]"}, '', 'g'), ${text}) > 0`;
}
function primaryTurma(userId: SQLWrapper, preferred: SQLWrapper) {
  return sql`coalesce(
    (select m.turma_id from gallery_turma_members m where m.user_id = ${userId} and m.turma_id = ${preferred}),
    (select m.turma_id from gallery_turma_members m join gallery_turmas t on t.id=m.turma_id where m.user_id=${userId} order by t.number desc limit 1))`;
}
function galleryWhere(filters: GalleryFilters) {
  const search = filters.query ? matchesText(sql`concat_ws(' ', ${projects.title}, ${projects.description},
    (select string_agg(u.name, ' ') from
      (select ${projects.authorId} as user_id union select a.user_id from gallery_project_authors a where a.project_id=${projects.id}) credits
      join gallery_users u on u.id=credits.user_id),
    (select string_agg(value, ' ') from jsonb_array_elements_text(${projects.technologies})))`, filters.query) : undefined;
  const cohort = filters.cohort ? or(
    inArray(projects.turmaId, db.select({ id: turmas.id }).from(turmas).where(eq(turmas.name, filters.cohort))),
    sql`exists(select 1 from gallery_project_authors a join gallery_users u on u.id=a.user_id
      join gallery_turmas t on t.id=${primaryTurma(sql`u.id`, sql`u.primary_turma_id`)}
      where a.project_id=${projects.id} and a.user_id<>${projects.authorId} and t.name=${filters.cohort})`,
  ) : undefined;
  return and(eq(projects.visibility, "published"), search, cohort,
    filters.finalOnly ? eq(projects.isFinal, true) : undefined,
    ...filters.techs.map(tech => sql`${projects.technologies} @> ${JSON.stringify([tech])}::jsonb`));
}
type AuthorRecord = { person: ProfileRow; groups: ProfileTurma[] };
// Indexed correlated reads hydrate only the selected projects, in the same round trip.
const authorRecords = sql<AuthorRecord[]>`(select jsonb_agg(jsonb_build_object('person', jsonb_build_object(
  'id', u.id, 'slug', u.slug, 'name', u.name, 'bio', u.bio, 'avatar', u.avatar,
  'github', u.github, 'linkedin', u.linkedin, 'primaryTurmaId', u.primary_turma_id),
  'groups', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'courseName', t.course_name, 'startYear', t.start_year) order by t.number desc)
    from gallery_turma_members m join gallery_turmas t on t.id=m.turma_id where m.user_id=u.id), '[]'::jsonb)))
  from (select ${projects.authorId} as user_id union select a.user_id from gallery_project_authors a where a.project_id=${projects.id}) credits
  join gallery_users u on u.id=credits.user_id)`;
async function projectRows<T extends typeof cardFields>(connection: Pick<typeof db, "select">, where: SQL | undefined, fields: T, options: { visitor?: string; limit: number; offset?: number; order?: SQL[]; participantId?: string; withTotal?: boolean }) {
  return connection.select({ project: fields, cohort: turmas.name, likes: likeTotal, people: authorRecords,
    likesObservedAt: sql<number>`(extract(epoch from statement_timestamp()) * 1000000)::bigint`.mapWith(Number),
    total: options.withTotal ? sql<number>`count(*) over()`.mapWith(Number) : sql<number>`0`,
    liked: options.visitor ? sql<boolean>`exists(select 1 from gallery_likes l where l.project_id=${projects.id} and l.visitor_key=${options.visitor})` : sql<boolean>`false`,
    moderationReason: options.participantId ? sql<string | null>`case when ${projects.authorId}=${options.participantId} and ${projects.visibility}='hidden' then ${projects.moderationReason} else null end` : sql<null>`null`,
  }).from(projects).innerJoin(turmas, eq(projects.turmaId, turmas.id)).where(where)
    .orderBy(...(options.order || [desc(projects.createdAt), desc(projects.id)]))
    .limit(options.limit).offset(options.offset || 0);
}
type ProjectRow<T> = { project: T; cohort: string; likes: number; liked: boolean; moderationReason: string | null; people: AuthorRecord[]; likesObservedAt: number };
function hydrateProjects<T extends { id: string; authorId: string; createdAt: Date }>(rows: ProjectRow<T>[]) {
  return rows.map(({ project, cohort, likes, liked, moderationReason, people, likesObservedAt }) => {
    const { authorId, createdAt, ...values } = project;
    const authors = people.map(({ person, groups }) => publicPerson(person, groups));
    const author = { ...authors.find(person => person.id === authorId)!, cohort };
    return { ...values, author, authors: [author, ...authors.filter(person => person.id !== authorId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))],
      createdAt: createdAt.toISOString(), likes, liked, likesObservedAt, moderationReason };
  });
}
async function visitorKey() { return (await cookies()).get("toti_visitor")?.value; }

/** participantId comes only from a verified server session, never a public query string. */
export async function readProject(options: { slug?: string; id?: string; participantId?: string; ownerOnly?: boolean }, connection: Pick<typeof db, "select"> = db): Promise<Project | null> {
  if (!options.slug && !options.id) return null;
  const where = and(options.id ? eq(projects.id, options.id) : eq(projects.slug, options.slug!),
    options.participantId ? participant(options.participantId) : eq(projects.visibility, "published"),
    options.ownerOnly ? eq(projects.authorId, options.participantId || "") : undefined);
  const rows = await projectRows(connection, where, projectFields, { limit: 1, participantId: options.participantId, visitor: await visitorKey() });
  return hydrateProjects(rows)[0] || null;
}
export const getProjectBySlug = cache(async (slug: string) => readProject({ slug }));

export async function getRelatedProjects(project: Project, connection: Pick<typeof db, "select"> = db) {
  const authors = project.authors.map(person => person.id);
  const sharedAuthor = or(inArray(projects.authorId, authors), inArray(projects.id, db.select({ id: projectAuthors.projectId }).from(projectAuthors).where(inArray(projectAuthors.userId, authors))));
  const rows = await projectRows(connection, and(eq(projects.visibility, "published"), ne(projects.id, project.id)), cardFields, {
    limit: 3, visitor: await visitorKey(), order: [sql`case when ${sharedAuthor} then 0 else 1 end`, desc(projects.createdAt), desc(projects.id)],
  });
  return hydrateProjects(rows);
}

export type ProjectScope = { kind: "gallery" } | { kind: "profile"; userId: string } | { kind: "mine"; userId: string };
async function projectCollection(filters: GalleryFilters, scope: ProjectScope, initial: boolean, connection: Pick<typeof db, "select">): Promise<CollectionPage<ProjectSummary>> {
  const where = scope.kind === "gallery" ? galleryWhere(filters) : and(participant(scope.userId), scope.kind === "profile" ? eq(projects.visibility, "published") : undefined);
  let page = initial ? initialCollectionPage(filters.page) : requestedPage(filters.page);
  const order = scope.kind !== "gallery" || filters.sort === "recent" ? [desc(projects.createdAt), desc(projects.id)]
    : filters.sort === "likes" ? [desc(likeTotal), desc(projects.createdAt), desc(projects.id)]
    : [sql`${projects.title} collate "pt-BR-x-icu"`, desc(projects.id)];
  const visitor = await visitorKey();
  const read = () => projectRows(connection, where, cardFields, { visitor,
    participantId: scope.kind === "mine" ? scope.userId : undefined, withTotal: true,
    limit: initial ? page * COLLECTION_PAGE_SIZE : COLLECTION_PAGE_SIZE + Number(page > 1),
    offset: initial ? 0 : Math.max(0, (page - 1) * COLLECTION_PAGE_SIZE - 1), order });
  let rows = await read();
  let total = rows[0]?.total || 0;
  if (!initial && (page > collectionPage(page, total) || (!rows.length && page > 1))) {
    if (!rows.length) [{ total }] = await connection.select({ total: count() }).from(projects).where(where);
    page = collectionPage(page, total);
    if (total) rows = await read();
  }
  page = collectionPage(page, total);
  const previousId = !initial && page > 1 ? rows.shift()?.project.id || null : null;
  return { items: hydrateProjects(rows), total, page, pageSize: COLLECTION_PAGE_SIZE, previousId, hasMore: page * COLLECTION_PAGE_SIZE < total };
}

/** API readers always return one bounded batch. Initial readers restore a bounded prefix. */
export function readProjectPage(filters: GalleryFilters, scope: ProjectScope = { kind: "gallery" }, connection: Pick<typeof db, "select"> = db) {
  return projectCollection(filters, scope, false, connection);
}
export async function readInitialProjects(filters: GalleryFilters, scope: ProjectScope = { kind: "gallery" }, connection: Pick<typeof db, "select"> = db): Promise<CollectionSnapshot<ProjectSummary>> {
  return collectionSnapshot(await projectCollection(filters, scope, true, connection));
}

export const getGalleryFilterOptions = cache(async (connection: ReadConnection = db): Promise<GalleryFilterOptions> => {
  const [groups, technologies] = await Promise.all([
    connection.execute<{ name: string }>(sql`select t.name from gallery_projects p join gallery_turmas t on t.id=p.turma_id where p.visibility='published'
      union select t.name from gallery_project_authors a join gallery_projects p on p.id=a.project_id join gallery_users u on u.id=a.user_id
      join gallery_turmas t on t.id=${primaryTurma(sql`u.id`, sql`u.primary_turma_id`)} where p.visibility='published' and a.user_id<>p.author_id`),
    connection.execute<{ name: string; total: number }>(sql`select tech.value as name, count(*)::int as total from gallery_projects p
      cross join lateral jsonb_array_elements_text(p.technologies) as tech(value) where p.visibility='published' group by tech.value`),
  ]);
  return { cohorts: groups.rows.map(row => row.name).sort((a, b) => b.localeCompare(a, "pt-BR", { numeric: true })),
    technologies: technologies.rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR")).map(row => row.name) };
});

export async function getProfileProjectStats(userId: string, connection: Pick<typeof db, "select"> = db) {
  const [stats] = await connection.select({ total: count(), totalLikes: sql<number>`coalesce(sum(${likeTotal}), 0)`.mapWith(Number) }).from(projects).where(and(eq(projects.visibility, "published"), participant(userId)));
  return stats;
}
export const getCommunityFilterOptions = cache(async (connection: Pick<typeof db, "select"> = db): Promise<GalleryFilterOptions> => {
  const rows = await connection.select({ name: turmas.name }).from(turmas).innerJoin(turmaMembers, eq(turmaMembers.turmaId, turmas.id))
    .innerJoin(users, eq(users.id, turmaMembers.userId)).where(or(eq(users.emailVerified, true), eq(users.isDemo, true))).groupBy(turmas.name);
  return { cohorts: rows.map(row => row.name).sort((a, b) => b.localeCompare(a, "pt-BR", { numeric: true })), technologies: [] };
});
async function communityCollection(filters: GalleryFilters, initial: boolean, connection: ReadConnection): Promise<CollectionPage<CommunityPerson>> {
  const where = and(or(eq(users.emailVerified, true), eq(users.isDemo, true)),
    inArray(users.id, db.select({ id: turmaMembers.userId }).from(turmaMembers)),
    filters.query ? matchesText(users.name, filters.query) : undefined,
    filters.cohort ? inArray(users.id, db.select({ id: turmaMembers.userId }).from(turmaMembers).innerJoin(turmas, eq(turmas.id, turmaMembers.turmaId)).where(eq(turmas.name, filters.cohort))) : undefined);
  let page = initial ? initialCollectionPage(filters.page) : requestedPage(filters.page);
  const read = () => connection.select({ id: users.id, total: sql<number>`count(*) over()`.mapWith(Number) }).from(users).where(where).orderBy(users.name, users.id)
    .limit(initial ? page * COLLECTION_PAGE_SIZE : COLLECTION_PAGE_SIZE + Number(page > 1)).offset(initial ? 0 : Math.max(0, (page - 1) * COLLECTION_PAGE_SIZE - 1));
  let rows = await read(), total = rows[0]?.total || 0;
  if (!initial && (page > collectionPage(page, total) || (!rows.length && page > 1))) {
    if (!rows.length) [{ total }] = await connection.select({ total: count() }).from(users).where(where);
    page = collectionPage(page, total);
    if (total) rows = await read();
  }
  page = collectionPage(page, total);
  const previousId = !initial && page > 1 ? rows.shift()?.id || null : null;
  const ids = rows.map(row => row.id);
  const [people, stats] = await Promise.all([
    peopleRows(false, connection, ids),
    ids.length ? connection.execute<{ user_id: string; total: number; total_likes: number }>(sql`
    with credits as (
      select p.id as project_id, p.author_id as user_id from gallery_projects p where p.visibility='published' and p.author_id in (${sql.join(ids.map(id => sql`${id}`), sql`,`)})
      union select a.project_id, a.user_id from gallery_project_authors a join gallery_projects p on p.id=a.project_id
        where p.visibility='published' and a.user_id in (${sql.join(ids.map(id => sql`${id}`), sql`,`)})
    ) select c.user_id, count(*)::int as total, sum(p.base_likes + (select count(*) from gallery_likes l where l.project_id=p.id))::int as total_likes
      from credits c join gallery_projects p on p.id=c.project_id group by c.user_id`) : { rows: [] },
  ]);
  const byUser = new Map(stats.rows.map(row => [row.user_id, row]));
  const items = people.map(person => ({ ...person, projectCount: byUser.get(person.id)?.total || 0, totalLikes: byUser.get(person.id)?.total_likes || 0 }));
  return { items, total, page, pageSize: COLLECTION_PAGE_SIZE, previousId, hasMore: page * COLLECTION_PAGE_SIZE < total };
}

export function readCommunityPage(filters: GalleryFilters, connection: ReadConnection = db) {
  return communityCollection(filters, false, connection);
}
export async function readInitialCommunity(filters: GalleryFilters, connection: ReadConnection = db): Promise<CollectionSnapshot<CommunityPerson>> {
  return collectionSnapshot(await communityCollection(filters, true, connection));
}
