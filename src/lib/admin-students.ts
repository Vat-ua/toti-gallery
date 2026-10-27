import { and, count, desc, eq, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, authSessions, invitations, projectAuthors, projects, turmaMembers, turmas, users } from "@/db/schema";
import { AdminError, staff } from "./admin-turmas";
import { canManageAccount } from "./permissions";
import { issueGrant } from "./access-links";
import { provisionIdentity } from "./admin-provision";
import type { ManagedStudent, StudentListPage, StudentInvitation } from "./admin-types";
import { parseStudentListParams, type StudentListParams } from "./student-list-params";
import { studentSearch } from "./student-search";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function targetStudent(tx: Transaction, actor: Awaited<ReturnType<typeof staff>>, id: string) {
  const [person] = await tx.select().from(users).where(eq(users.id, id)).for("update").limit(1);
  if (!person) throw new AdminError("Estudante não encontrado.", 404);
  if (!canManageAccount(actor, person)) throw new AdminError("Você não pode gerenciar esta conta.", 403);
  if (person.role !== "user") {
    const [membership] = await tx.select().from(turmaMembers).where(eq(turmaMembers.userId, id)).limit(1);
    if (!membership) throw new AdminError("Esta conta é gerenciada em Administradores.", 403);
  }
  return person;
}

export async function listStudents(actorId: string, options: Partial<StudentListParams> = {}): Promise<StudentListPage> {
  const filters = parseStudentListParams({ q: options.query, turma: options.turmaId, status: options.status, page: options.page, pageSize: options.pageSize });
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const membershipsQuery = tx.select({ id: turmaMembers.userId }).from(turmaMembers);
    const where = and(
      or(eq(users.role, "user"), inArray(users.id, membershipsQuery)),
      studentSearch(filters.query),
      filters.turmaId === "all" ? undefined : filters.turmaId === "none" ? notInArray(users.id, membershipsQuery) : inArray(users.id, tx.select({ id: turmaMembers.userId }).from(turmaMembers).where(eq(turmaMembers.turmaId, filters.turmaId))),
      filters.status === "all" ? undefined : filters.status === "demo" ? eq(users.isDemo, true) : and(eq(users.isDemo, false), eq(users.status, filters.status)),
    );
    const [{ total }] = await tx.select({ total: count() }).from(users).where(where);
    const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.pageSize)));
    const people = await tx.select({ id: users.id, name: users.name, email: users.email, emailVerified: users.emailVerified, avatar: users.image, status: users.status, role: users.role, isDemo: users.isDemo }).from(users).where(where).orderBy(users.name, users.id).limit(filters.pageSize).offset((page - 1) * filters.pageSize);
    const ids = people.map(person => person.id);
    if (!ids.length) return { students: [], total, filters: { ...filters, page } };
    const memberships = await tx.select({ userId: turmaMembers.userId, turmaId: turmas.id, name: turmas.name }).from(turmaMembers).innerJoin(turmas, eq(turmaMembers.turmaId, turmas.id)).where(inArray(turmaMembers.userId, ids)).orderBy(desc(turmas.number));
    // Fetch latest metadata only, for this page; no bearer tokens or full history.
    const grants = await tx.selectDistinctOn([invitations.userId, invitations.purpose], { id: invitations.id, userId: invitations.userId, purpose: invitations.purpose, expiresAt: invitations.expiresAt, consumedAt: invitations.consumedAt, revokedAt: invitations.revokedAt }).from(invitations).where(inArray(invitations.userId, ids)).orderBy(invitations.userId, invitations.purpose, desc(invitations.createdAt), desc(invitations.id));
    const now = new Date();
    const students: ManagedStudent[] = people.map(person => {
      const groups = memberships.filter(m => m.userId === person.id);
      const grant = grants.find(g => g.userId === person.id && g.purpose === (person.status === "pending" ? "activation" : "password_reset"));
      return { ...person, turmaNames: groups.map(g => g.name), turmaIds: groups.map(g => g.turmaId), accessLink: grant ? {
        id: grant.id, purpose: grant.purpose, expiresAt: grant.expiresAt.toISOString(),
        state: grant.consumedAt ? "used" : grant.revokedAt ? "revoked" : grant.expiresAt <= now ? "expired" : "valid",
      } : null };
    });
    return { students, total, filters: { ...filters, page } };
  }, { isolationLevel: "repeatable read" });
}

export async function updateStudentProfile(actorId: string, id: string, name: unknown, email: unknown) {
  if (typeof name !== "string" || typeof email !== "string") throw new AdminError("Informe um nome e email válidos.");
  let identity: ReturnType<typeof provisionIdentity>;
  try { identity = provisionIdentity(name, email); }
  catch { throw new AdminError("Informe um nome de 2 a 70 caracteres e um email válido."); }
  try {
    return await db.transaction(async tx => {
      const actor = await staff(tx, actorId);
      // Match provisioning's lock order before taking the user row lock.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identity.email}))`);
      const person = await targetStudent(tx, actor, id);
      const emailChanged = identity.email !== person.email;
      if (emailChanged && (person.status !== "pending" || person.emailVerified || person.isDemo)) throw new AdminError("O email só pode ser alterado antes da ativação da conta.", 409);
      if (emailChanged) {
        const [existing] = await tx.select({ id: users.id }).from(users).where(and(eq(users.email, identity.email), ne(users.id, id))).limit(1);
        if (existing) throw new AdminError("Este email já está cadastrado em outro perfil.", 409);
        await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.userId, id), isNull(invitations.consumedAt), isNull(invitations.revokedAt)));
      }
      await tx.update(users).set({ ...identity, updatedAt: new Date() }).where(eq(users.id, id));
      return { ...identity, emailChanged };
    });
  } catch (error) {
    const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
    if (code === "23505") throw new AdminError("Este email já está cadastrado em outro perfil.", 409);
    throw error;
  }
}

export async function deletePendingStudent(actorId: string, id: string) {
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId), person = await targetStudent(tx, actor, id);
    if (person.role !== "user" || person.isDemo || person.status !== "pending" || person.emailVerified) throw new AdminError("Só é possível excluir cadastros de estudantes que ainda não ativaram a conta.", 409);
    // A pending profile normally has no account or history. Protect inconsistent
    // or historical rows as well, especially authorship's cascading foreign key.
    const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, id)).limit(1);
    const [session] = await tx.select({ id: authSessions.id }).from(authSessions).where(eq(authSessions.userId, id)).limit(1);
    const [credit] = await tx.select({ id: projectAuthors.projectId }).from(projectAuthors).where(eq(projectAuthors.userId, id)).limit(1);
    const [publication] = await tx.select({ id: projects.id }).from(projects).where(or(eq(projects.authorId, id), eq(projects.moderatedBy, id))).limit(1);
    const [issued] = await tx.select({ id: invitations.id }).from(invitations).where(eq(invitations.createdBy, id)).limit(1);
    if (account || session || credit || publication || issued) throw new AdminError("Este cadastro tem um histórico associado e não pode ser excluído.", 409);
    await tx.delete(invitations).where(eq(invitations.userId, id));
    await tx.delete(turmaMembers).where(eq(turmaMembers.userId, id));
    await tx.delete(users).where(eq(users.id, id));
    return { id };
  });
}

export async function updateStudentTurmas(actorId: string, id: string, turmaIds: unknown) {
  if (!Array.isArray(turmaIds) || turmaIds.length > 100 || turmaIds.some(value => typeof value !== "string" || !value) || new Set(turmaIds).size !== turmaIds.length) throw new AdminError("Confira as turmas selecionadas.");
  const selected = turmaIds as string[];
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId); await targetStudent(tx, actor, id);
    if (selected.length) {
      const groups = await tx.select({ id: turmas.id }).from(turmas).where(inArray(turmas.id, selected)).for("share");
      if (groups.length !== selected.length) throw new AdminError("Uma das turmas não está disponível. Atualize a página.");
      await tx.insert(turmaMembers).values(selected.map(turmaId => ({ turmaId, userId: id }))).onConflictDoNothing();
    }
    await tx.delete(turmaMembers).where(selected.length ? and(eq(turmaMembers.userId, id), notInArray(turmaMembers.turmaId, selected)) : eq(turmaMembers.userId, id));
    return { turmaIds: selected };
  });
}

export async function setStudentSuspended(actorId: string, id: string, suspended: boolean) {
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId), person = await targetStudent(tx, actor, id);
    if (person.role !== "user" || person.isDemo) throw new AdminError("Esta ação está disponível apenas para contas de estudantes reais.", 403);
    if (suspended === (person.status === "suspended")) return { status: person.status };
    const status = suspended ? "suspended" : person.emailVerified ? "active" : "pending";
    const now = new Date();
    await tx.update(users).set({ status, updatedAt: now }).where(eq(users.id, id));
    // Restore never revives earlier cookies or activation/recovery links.
    await tx.delete(authSessions).where(eq(authSessions.userId, id));
    await tx.update(invitations).set({ revokedAt: now }).where(and(eq(invitations.userId, id), isNull(invitations.consumedAt), isNull(invitations.revokedAt)));
    return { status };
  });
}

export async function studentAccessLink(actorId: string, id: string, purpose: unknown) {
  if (purpose !== "activation" && purpose !== "password_reset") throw new AdminError("Escolha uma finalidade válida.");
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId), person = await targetStudent(tx, actor, id);
    if (person.isDemo || person.status !== (purpose === "activation" ? "pending" : "active")) throw new AdminError("Não é possível criar este link para a conta selecionada.");
    const grant = await issueGrant(tx, actorId, id, purpose);
    return { url: grant.url, expiresAt: grant.expiresAt.toISOString() };
  });
}

export async function revokeStudentLink(actorId: string, id: string, grantId: unknown) {
  if (typeof grantId !== "string" || !grantId) throw new AdminError("Escolha um link válido.");
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId); await targetStudent(tx, actor, id);
    const [grant] = await tx.select().from(invitations).where(and(eq(invitations.id, grantId), eq(invitations.userId, id))).limit(1);
    if (!grant) throw new AdminError("Link não encontrado.", 404);
    if (!grant.consumedAt && !grant.revokedAt) await tx.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, grant.id));
  });
}

export async function createStudentInvitations(actorId: string, ids: unknown): Promise<StudentInvitation[]> {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) throw new AdminError("Selecione de 1 a 100 estudantes pendentes.");
  const selected = (ids as string[]).toSorted();
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const people = await tx.select().from(users).where(inArray(users.id, selected)).orderBy(users.id).for("update");
    if (people.length !== selected.length || people.some(p => p.role !== "user" || p.isDemo || p.status !== "pending")) throw new AdminError("A lista mudou. Atualize a página e selecione apenas estudantes pendentes.");
    const result: StudentInvitation[] = [];
    for (const person of people) {
      const grant = await issueGrant(tx, actorId, person.id, "activation");
      result.push({ id: person.id, name: person.name, email: person.email, url: grant.url, expiresAt: grant.expiresAt.toISOString() });
    }
    return result;
  });
}
