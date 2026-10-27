import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects, turmaMembers, turmas, users } from "@/db/schema";
import { isStaff, canManageAccount } from "./permissions";
import { parseStudents } from "./student-import";
import { provisionIdentity } from "./admin-provision";
import type { StudentAdded, StudentLookup, AdminStudent, AdminTurma, ImportPreview, TurmaProject } from "./admin-types";

export class AdminError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function staff(tx: Transaction, actorId: string) {
  const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for("share").limit(1);
  if (!actor || !isStaff(actor.role) || actor.isDemo || actor.status !== "active") throw new AdminError("Acesso restrito à administração.", 403);
  return actor;
}
async function group(tx: Transaction, id: string) {
  const [turma] = await tx.select().from(turmas).where(eq(turmas.id, id)).limit(1);
  if (!turma) throw new AdminError("Turma não encontrada.", 404);
  return turma;
}

export function validateTurma(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminError("Confira os dados da turma.");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(k => !["number", "courseName", "startYear"].includes(k))) throw new AdminError("Confira os dados da turma.");
  if (typeof data.number !== "number" || !Number.isInteger(data.number) || data.number < 1 || data.number > 999999999) throw new AdminError("Informe um número de turma válido.");
  if (typeof data.courseName !== "string" || data.courseName.trim().length < 2 || data.courseName.trim().length > 100) throw new AdminError("Informe o nome do curso, de 2 a 100 caracteres.");
  if (typeof data.startYear !== "number" || !Number.isInteger(data.startYear) || data.startYear < 2000 || data.startYear > 2100) throw new AdminError("Informe o ano de início, de 2000 a 2100.");
  return { number: data.number, name: `Turma ${data.number}`, courseName: data.courseName.trim(), startYear: data.startYear };
}

export async function listTurmas(actorId: string): Promise<AdminTurma[]> {
  return db.transaction(async tx => {
    await staff(tx, actorId);
    const rows = await tx.select().from(turmas).orderBy(asc(turmas.name));
    const members = await tx.select({ id: turmaMembers.turmaId, n: count() }).from(turmaMembers).groupBy(turmaMembers.turmaId);
    const publications = await tx.select({ id: projects.turmaId, n: count() }).from(projects).groupBy(projects.turmaId);
    return rows.map(row => ({ id: row.id, name: row.name, number: row.number, courseName: row.courseName, startYear: row.startYear, archived: !!row.archivedAt,
      students: members.find(m => m.id === row.id)?.n || 0, projects: publications.find(p => p.id === row.id)?.n || 0 }));
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

export async function turmaDetails(actorId: string, id: string) {
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId);
    const turma = await group(tx, id);
    const memberships = await tx.select({ userId: turmaMembers.userId, turmaId: turmas.id, name: turmas.name }).from(turmaMembers).innerJoin(turmas, eq(turmas.id, turmaMembers.turmaId));
    const people = await tx.select({ id: users.id, name: users.name, email: users.email, avatar: users.image, status: users.status, role: users.role, isDemo: users.isDemo }).from(users).orderBy(users.name);
    const publications = await tx.select({ id: projects.id, slug: projects.slug, title: projects.title, author: users.name, isFinal: projects.isFinal, visibility: projects.visibility })
      .from(projects).innerJoin(users, eq(projects.authorId, users.id)).where(eq(projects.turmaId, id)).orderBy(projects.createdAt);
    const allPeople: AdminStudent[] = people.map(person => ({ ...person, turmaNames: memberships.filter(m => m.userId === person.id).map(m => m.name) }));
    const memberIds = new Set(memberships.filter(m => m.turmaId === id).map(m => m.userId));
    return { turma: { id, name: turma.name, number: turma.number, courseName: turma.courseName, startYear: turma.startYear, archived: !!turma.archivedAt },
      members: allPeople.filter(p => memberIds.has(p.id)),
      candidates: allPeople.filter(p => !memberIds.has(p.id) && canManageAccount(actor, p) && p.status !== "suspended"),
      projects: publications as TurmaProject[] };
  });
}

export async function setMembership(actorId: string, turmaId: string, userId: string, add: boolean) {
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId); await group(tx, turmaId);
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1);
    if (!target || !canManageAccount(actor, target)) throw new AdminError("Você não pode alterar a turma desta conta.", 403);
    if (add && target.status === "suspended") throw new AdminError("Esta conta está suspensa.");
    if (add) await tx.insert(turmaMembers).values({ turmaId, userId }).onConflictDoNothing();
    else await tx.delete(turmaMembers).where(and(eq(turmaMembers.turmaId, turmaId), eq(turmaMembers.userId, userId)));
    // Credits and project turma are deliberately independent of membership.
  });
}

export async function importStudents(actorId: string, turmaId: string, text: string, excluded: number[] = [], commit = false) {
  let parsed;
  try { parsed = parseStudents(text); } catch (error) { throw new AdminError(error instanceof Error ? error.message : "Lista inválida."); }
  return db.transaction(async tx => {
    await staff(tx, actorId); await group(tx, turmaId);
    const emails = [...new Set(parsed.filter(r => !r.error).map(r => r.email))].sort();
    if (commit) for (const email of emails) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    const existing = emails.length ? await tx.select().from(users).where(inArray(sql<string>`lower(btrim(${users.email}))`, emails)).for(commit ? "update" : "share") : [];
    const memberships = await tx.select({ id: turmaMembers.userId }).from(turmaMembers).where(eq(turmaMembers.turmaId, turmaId));
    const memberIds = new Set(memberships.map(m => m.id));
    const preview: ImportPreview[] = parsed.map(row => {
      const user = existing.find(u => u.email.trim().toLowerCase() === row.email);
      const error = row.error || (user?.isDemo ? "Email de perfil de exemplo." : user?.role !== undefined && user.role !== "user" ? "Email de conta administrativa." : user?.status === "suspended" ? "Conta suspensa; o acesso não será alterado." : undefined);
      return { ...row, error, kind: error ? "error" : !user ? "new" : memberIds.has(user.id) ? "member" : "existing" };
    });
    if (!commit) return { preview, created: 0, linked: 0, unchanged: 0 };
    const selected = preview.filter(r => !excluded.includes(r.line));
    if (!selected.length || selected.some(r => r.kind === "error")) throw new AdminError("Corrija ou exclua as linhas com erro antes de importar.");
    let created = 0, linked = 0, unchanged = 0;
    for (const row of selected) {
      if (row.kind === "member") { unchanged++; continue; }
      let id = existing.find(u => u.email.trim().toLowerCase() === row.email)?.id;
      if (!id) {
        id = randomUUID();
        await tx.insert(users).values({ id, name: row.name, email: row.email }); created++;
      }
      const inserted = await tx.insert(turmaMembers).values({ turmaId, userId: id }).onConflictDoNothing().returning();
      if (inserted.length) linked++; else unchanged++;
    }
    return { preview, created, linked, unchanged };
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
  let identity;
  try { identity = provisionIdentity(name, email); } catch { throw new AdminError("Informe um nome e email válidos."); }
  return db.transaction(async tx => {
    const actor = await staff(tx, actorId); await group(tx, turmaId);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identity.email}))`);
    let [user] = await tx.select().from(users).where(sql`lower(btrim(${users.email})) = ${identity.email}`).for("update").limit(1);
    const created = !user;
    if (user && (!canManageAccount(actor, user) || user.isDemo || user.status === "suspended")) throw new AdminError("Este perfil não está disponível para cadastro nesta turma.");
    if (!user) [user] = await tx.insert(users).values({ id: randomUUID(), ...identity }).returning();
    await tx.insert(turmaMembers).values({ turmaId, userId: user.id }).onConflictDoNothing();
    return { id: user.id, name: user.name, email: user.email, status: user.status, created };
  });
}
