import { identityErrors, rejectFields, turmaErrors } from "./form-validation";
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, turmaMembers, turmas, users } from "@/db/schema";
import { canManageAccount } from "./permissions";
import { AdminError, staff } from "./admin-server";
export { AdminError } from "./admin-server";
import { parseStudents } from "./student-import";
import { provisionIdentity } from "./admin-provision";
import { studentSearch } from "./student-search";
import type { StudentAdded, StudentLookup, AdminStudent, AdminTurma, AdminTurmaChoice, ImportPreview } from "./admin-types";
import { allocateProfileSlug, allocateProfileSlugs } from "./profile-slug-server";
import { issueGrant } from "./access-links";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function group(tx: Transaction, id: string) {
  const [turma] = await tx.select().from(turmas).where(eq(turmas.id, id)).limit(1);
  if (!turma) throw new AdminError("Turma não encontrada.", 404);
  return turma;
}

export async function findStudentCandidates(actorId: string, turmaId: string, query: string) {
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId); await group(tx, turmaId);
    return tx.select({ id: users.id, name: users.name, email: users.email, status: users.status, isDemo: users.isDemo }).from(users).where(and(
      actor.role === "owner" ? undefined : eq(users.role, "user"),
      sql`${users.status} <> 'suspended'`,
      notInArray(users.id, tx.select({ id: turmaMembers.userId }).from(turmaMembers).where(eq(turmaMembers.turmaId, turmaId))),
      studentSearch(query),
    )).orderBy(users.name, users.id).limit(25);
  });
}

export function validateTurma(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminError("Confira os dados da turma.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(k => !["number", "courseName", "startYear"].includes(k))) throw new AdminError("Confira os dados da turma.");
  rejectFields(turmaErrors(data));
  return { number: data.number as number, name: `Turma ${data.number}`, courseName: (data.courseName as string).trim(), startYear: data.startYear as number };
}

const turmaFields = { id: turmas.id, name: turmas.name, number: turmas.number, courseName: turmas.courseName,
  startYear: turmas.startYear, archived: sql<boolean>`${turmas.archivedAt} is not null` };
const memberCount = sql<number>`(select count(*) from gallery_turma_members m where m.turma_id=gallery_turmas.id)`.mapWith(Number);
const projectCount = sql<number>`(select count(*) from gallery_projects p where p.turma_id=gallery_turmas.id)`.mapWith(Number);

export async function listTurmas(actorId: string): Promise<AdminTurma[]> {
  return db.transaction(async tx => {
    await staff(tx, actorId);
    return tx.select({ ...turmaFields, students: memberCount, projects: projectCount }).from(turmas).orderBy(asc(turmas.name));
  });
}
/** Filters and provisioning forms need the choices, not whole-platform counters. */
export async function listTurmaChoices(actorId: string): Promise<AdminTurmaChoice[]> {
  return db.transaction(async tx => {
    await staff(tx, actorId);
    return tx.select(turmaFields).from(turmas).orderBy(sql`${turmas.archivedAt} is not null`, sql`${turmas.number} desc`);
  });
}

export async function saveTurma(actorId: string, value: unknown, id?: string) {
  const data = validateTurma(value);
  return db.transaction(async tx => {
    await staff(tx, actorId);
    // The normalized unique index is the final concurrency guard.
    if (id) { await group(tx, id); await tx.update(turmas).set(data).where(eq(turmas.id, id)); return { id }; }
    const newId = randomUUID();
    await tx.insert(turmas).values({ id: newId, ...data });
    return { id: newId };
  });
}
export async function archiveTurma(actorId: string, id: string, archived: boolean) {
  return db.transaction(async tx => {
    await staff(tx, actorId); await group(tx, id);
    await tx.update(turmas).set({ archivedAt: archived ? new Date() : null }).where(eq(turmas.id, id));
  });
}

export async function turmaDetails(actorId: string, id: string, options: { includeMembers?: boolean } = {}) {
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const [summary] = await tx.select({ turma: turmaFields, memberCount, projectCount }).from(turmas).where(eq(turmas.id, id)).limit(1);
    if (!summary) throw new AdminError("Turma não encontrada.", 404);
    const members: AdminStudent[] = [];
    if (options.includeMembers !== false) {
      const rows = await tx.select({ id: users.id, name: users.name, email: users.email, avatar: users.image, status: users.status,
        role: users.role, isDemo: users.isDemo, primaryTurmaId: users.primaryTurmaId,
        groups: sql<{ id: string; name: string }[]>`coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.number desc)
          from gallery_turma_members m join gallery_turmas t on t.id=m.turma_id where m.user_id=${users.id}), '[]'::jsonb)`,
      }).from(turmaMembers).innerJoin(users, eq(users.id, turmaMembers.userId)).where(eq(turmaMembers.turmaId, id)).orderBy(users.name, users.id);
      members.push(...rows.map(({ groups, ...person }) => ({ ...person, turmaNames: groups.map(g => g.name), turmaIds: groups.map(g => g.id) })));
    }
    return { ...summary, members };
  }, { isolationLevel: "repeatable read" });
}

export async function turmaAccessLink(actorId: string, turmaId: string, userId: string, purpose: unknown) {
  if (purpose !== "activation" && purpose !== "password_reset") throw new AdminError("Escolha um estudante e uma finalidade.");
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId, userId);
    await group(tx, turmaId);
    const [person] = await tx.select().from(users).where(and(eq(users.id, userId), actor.role === "owner" ? undefined : eq(users.role, "user"))).for("update").limit(1);
    const [membership] = await tx.select({ id: turmaMembers.userId }).from(turmaMembers).where(and(eq(turmaMembers.userId, userId), eq(turmaMembers.turmaId, turmaId))).limit(1);
    if (!membership) throw new AdminError("Estudante não encontrado nesta turma.", 404);
    if (!person || !canManageAccount(actor, person) || person.isDemo || person.status !== (purpose === "activation" ? "pending" : "active")) throw new AdminError("Não é possível criar este link para a conta selecionada.");
    const grant = await issueGrant(tx, actorId, userId, purpose);
    return { url: grant.url, expiresAt: grant.expiresAt.toISOString() };
  });
}

export async function setMembership(actorId: string, turmaId: string, userId: string, add: boolean) {
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId, userId); await group(tx, turmaId);
    const [target] = await tx.select().from(users).where(and(eq(users.id, userId), actor.role === "owner" ? undefined : eq(users.role, "user"))).for("update").limit(1);
    if (!target || !canManageAccount(actor, target)) throw new AdminError("Você não pode alterar a turma desta conta.", 403);
    if (add && target.status === "suspended") throw new AdminError("Esta conta está suspensa.");
    if (add) await tx.insert(turmaMembers).values({ turmaId, userId }).onConflictDoNothing();
    else {
      if (target.primaryTurmaId === turmaId) await tx.update(users).set({ primaryTurmaId: null }).where(eq(users.id, userId));
      await tx.delete(turmaMembers).where(and(eq(turmaMembers.turmaId, turmaId), eq(turmaMembers.userId, userId)));
    }
    // Credits and project turma are deliberately independent of membership.
  });
}

export async function importStudents(actorId: string, turmaId: string, text: string, excluded: number[] = [], commit = false) {
  let parsed;
  try { parsed = parseStudents(text); } catch (error) { throw new AdminError(error instanceof Error ? error.message : "Lista inválida."); }
  return db.transaction(async tx => {
    await staff(tx, actorId); await group(tx, turmaId);
    const selectedRows = parsed.filter(row => !excluded.includes(row.line));
    const invalid = () => new AdminError("Corrija ou exclua as linhas com erro antes de importar.");
    if (commit && (!selectedRows.length || selectedRows.some(row => row.error))) throw invalid();
    const emails = [...new Set(parsed.filter(row => !row.error).map(row => row.email))];
    const selectedEmails = new Set(selectedRows.map(row => row.email));
    if (commit) {
      // Acquire all email locks in a stable order in one round trip.
      const values = selectedRows.map(row => sql`${row.email}`);
      await tx.execute(sql`select pg_advisory_xact_lock(key) from (select distinct hashtext(email) as key from unnest(array[${sql.join(values, sql`, `)}]::text[]) as input(email) order by key) as ordered`);
    }
    let existing = emails.length ? await tx.select().from(users).where(inArray(sql<string>`lower(btrim(${users.email}))`, emails)) : [];
    if (commit) {
      // Protected accounts are classified as errors, without locking other staff
      // rows or upgrading the actor's own authorization lock.
      const ids = existing.filter(user => selectedEmails.has(user.email.trim().toLowerCase()) && user.role === "user" && !user.isDemo && user.status !== "suspended").map(user => user.id);
      const locked = ids.length ? await tx.select().from(users).where(inArray(users.id, ids)).orderBy(users.id).for("update") : [];
      const byId = new Map(locked.map(user => [user.id, user]));
      existing = existing.map(user => byId.get(user.id) || user);
    }
    const existingIds = existing.map(user => user.id);
    const memberships = existingIds.length ? await tx.select({ id: turmaMembers.userId }).from(turmaMembers).where(and(eq(turmaMembers.turmaId, turmaId), inArray(turmaMembers.userId, existingIds))) : [];
    const memberIds = new Set(memberships.map(member => member.id));
    const byEmail = new Map(existing.map(user => [user.email.trim().toLowerCase(), user]));
    const preview: ImportPreview[] = parsed.map(row => {
      const user = byEmail.get(row.email);
      const error = row.error || (user?.isDemo ? "Email de perfil de exemplo." : user?.role !== undefined && user.role !== "user" ? "Email de conta administrativa." : user?.status === "suspended" ? "Conta suspensa; o acesso não será alterado." : undefined);
      return { ...row, error, kind: error ? "error" : !user ? "new" : memberIds.has(user.id) ? "member" : "existing" };
    });
    if (!commit) return { preview, created: 0, linked: 0, unchanged: 0 };
    const selected = preview.filter(row => !excluded.includes(row.line));
    if (selected.some(row => row.kind === "error")) throw invalid();
    const fresh = selected.filter(row => row.kind === "new");
    const slugs = await allocateProfileSlugs(tx, fresh.map(row => row.name));
    const newPeople = fresh.map((row, index) => ({ id: randomUUID(), name: row.name, email: row.email, slug: slugs[index] }));
    if (newPeople.length) await tx.insert(users).values(newPeople);
    const idsByEmail = new Map([...existing, ...newPeople].map(user => [user.email.trim().toLowerCase(), user.id]));
    const links = selected.filter(row => row.kind !== "member").map(row => ({ turmaId, userId: idsByEmail.get(row.email)! }));
    const inserted = links.length ? await tx.insert(turmaMembers).values(links).onConflictDoNothing().returning({ id: turmaMembers.userId }) : [];
    return { preview, created: newPeople.length, linked: inserted.length, unchanged: selected.length - inserted.length };
  });
}

export async function lookupStudent(actorId: string, turmaId: string, email: string): Promise<StudentLookup | null> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new AdminError("Informe um email válido.");
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId); await group(tx, turmaId);
    const [user] = await tx.select().from(users).where(sql`lower(btrim(${users.email})) = ${normalized}`).limit(1);
    if (!user) return null;
    const [membership] = await tx.select().from(turmaMembers).where(and(eq(turmaMembers.userId, user.id), eq(turmaMembers.turmaId, turmaId))).limit(1);
    const reason = !canManageAccount(actor, user) ? "Você não pode gerenciar esta conta." : user.status === "suspended" ? "Esta conta está suspensa." : user.isDemo ? "Este é um perfil de exemplo. Use a aba Perfil existente para alterar sua participação." : null;
    return { id: user.id, name: user.name, email: user.email, status: user.status, member: !!membership, blocked: !!reason, reason };
  });
}

export async function addStudent(actorId: string, turmaId: string, name: string, email: string): Promise<StudentAdded> {
  rejectFields(identityErrors(name, email));
  const identity = provisionIdentity(name, email);
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId); await group(tx, turmaId);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identity.email}))`);
    let user = identity.email === actor.email.trim().toLowerCase() ? actor : (await tx.select().from(users).where(sql`lower(btrim(${users.email})) = ${identity.email}`).limit(1))[0];
    if (user && (!canManageAccount(actor, user) || user.isDemo || user.status === "suspended")) throw new AdminError("Este perfil não está disponível para cadastro nesta turma.");
    if (user && user.id !== actorId) {
      const [locked] = await tx.select().from(users).where(and(eq(users.id, user.id), actor.role === "owner" ? undefined : eq(users.role, "user"))).for("update").limit(1);
      if (!locked) throw new AdminError("O perfil mudou. Atualize a página e tente novamente.", 409);
      user = locked;
    }
    const created = !user;
    if (user && (!canManageAccount(actor, user) || user.isDemo || user.status === "suspended")) throw new AdminError("Este perfil não está disponível para cadastro nesta turma.");
    if (!user) [user] = await tx.insert(users).values({ id: randomUUID(), ...identity, slug: await allocateProfileSlug(tx, identity.name) }).returning();
    await tx.insert(turmaMembers).values({ turmaId, userId: user.id }).onConflictDoNothing();
    return { id: user.id, name: user.name, email: user.email, status: user.status, created };
  });
}
