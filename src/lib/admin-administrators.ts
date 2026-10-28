import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, invitations, users } from "@/db/schema";
import { AdminError, staff } from "./admin-turmas";
import { provisionIdentity } from "./admin-provision";
import { issueGrant } from "./access-links";
import { studentSearch } from "./student-search";
import type { AdministratorCandidate, ManagedAdministrator } from "./admin-types";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function owner(tx: Transaction, actorId: string) {
  const actor = await staff(tx, actorId);
  if (actor.role !== "owner") throw new AdminError("Acesso restrito ao proprietário.", 403);
  return actor;
}

async function administrator(tx: Transaction, actorId: string, id: string) {
  // Do not upgrade the owner's shared authorization lock to an update lock.
  if (actorId === id) throw new AdminError("A conta do proprietário é protegida.", 409);
  const [person] = await tx.select().from(users).where(eq(users.id, id)).for("update").limit(1);
  if (!person) throw new AdminError("Administrador não encontrado.", 404);
  if (person.role === "owner") throw new AdminError("A conta do proprietário é protegida.", 409);
  if (person.role !== "admin" || person.isDemo) throw new AdminError("Esta conta não é administradora. Atualize a página.", 409);
  return person;
}

async function revokeAccess(tx: Transaction, id: string) {
  await tx.delete(authSessions).where(eq(authSessions.userId, id));
  await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.userId, id), isNull(invitations.consumedAt), isNull(invitations.revokedAt)));
}

export async function listAdministrators(actorId: string): Promise<ManagedAdministrator[]> {
  return db.transaction(async tx => {
    await owner(tx, actorId);
    const people = await tx.select({ id: users.id, name: users.name, email: users.email, avatar: users.image, role: users.role, status: users.status })
      .from(users).where(and(inArray(users.role, ["owner", "admin"]), eq(users.isDemo, false)))
      .orderBy(sql`case when ${users.role} = 'owner' then 0 else 1 end`, users.name, users.id);
    const ids = people.map(person => person.id);
    const grants = ids.length ? await tx.selectDistinctOn([invitations.userId, invitations.purpose], {
      id: invitations.id, userId: invitations.userId, purpose: invitations.purpose,
      expiresAt: invitations.expiresAt, consumedAt: invitations.consumedAt, revokedAt: invitations.revokedAt,
    }).from(invitations).where(inArray(invitations.userId, ids)).orderBy(invitations.userId, invitations.purpose, desc(invitations.createdAt), desc(invitations.id)) : [];
    const now = new Date();
    return people.map(person => {
      const grant = person.role === "owner" ? undefined : grants.find(g => g.userId === person.id && g.purpose === (person.status === "pending" ? "activation" : "password_reset"));
      return { ...person, role: person.role as "admin" | "owner", accessLink: grant ? {
        id: grant.id, purpose: grant.purpose, expiresAt: grant.expiresAt.toISOString(),
        state: grant.consumedAt ? "used" : grant.revokedAt ? "revoked" : grant.expiresAt <= now ? "expired" : "valid",
      } : null };
    });
  }, { isolationLevel: "repeatable read" });
}

export async function findAdministratorCandidates(actorId: string, query: string): Promise<AdministratorCandidate[]> {
  return db.transaction(async tx => {
    await owner(tx, actorId);
    if (query.trim().length < 2) return [];
    return tx.select({ id: users.id, name: users.name, email: users.email, status: users.status }).from(users).where(and(
      eq(users.role, "user"), eq(users.isDemo, false),
      sql`((${users.status} = 'active' and ${users.emailVerified}) or (${users.status} = 'pending' and not ${users.emailVerified}))`,
      studentSearch(query),
    )).orderBy(users.name, users.id).limit(25);
  });
}

export async function createAdministrator(actorId: string, name: unknown, email: unknown) {
  if (typeof name !== "string" || typeof email !== "string") throw new AdminError("Informe um nome e email válidos.");
  let identity: ReturnType<typeof provisionIdentity>;
  try { identity = provisionIdentity(name, email); }
  catch { throw new AdminError("Informe um nome de 2 a 70 caracteres e um email válido."); }
  return db.transaction(async tx => {
    await owner(tx, actorId);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identity.email}))`);
    const [existing] = await tx.select({ id: users.id }).from(users).where(sql`lower(btrim(${users.email})) = ${identity.email}`).for("update").limit(1);
    if (existing) throw new AdminError("Este email já tem um perfil. Use Perfil existente para conceder acesso.", 409);
    const id = randomUUID();
    await tx.insert(users).values({ id, ...identity, role: "admin", status: "pending" });
    const grant = await issueGrant(tx, actorId, id, "activation");
    return { id, name: identity.name, email: identity.email, grant: { url: grant.url, expiresAt: grant.expiresAt.toISOString() } };
  });
}

export async function promoteAdministrator(actorId: string, id: unknown) {
  if (typeof id !== "string" || !id || id.length > 100) throw new AdminError("Escolha um perfil válido.");
  return db.transaction(async tx => {
    await owner(tx, actorId);
    if (id === actorId) throw new AdminError("A conta do proprietário é protegida.", 409);
    const [person] = await tx.select().from(users).where(eq(users.id, id)).for("update").limit(1);
    if (!person) throw new AdminError("Perfil não encontrado.", 404);
    if (person.role !== "user" || person.isDemo || !((person.status === "active" && person.emailVerified) || (person.status === "pending" && !person.emailVerified))) {
      throw new AdminError("Escolha um perfil real, ativo ou pendente, que ainda não seja administrador.", 409);
    }
    // Old student sessions and recovery grants must not gain staff privileges.
    await revokeAccess(tx, id);
    await tx.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, id));
    const grant = person.status === "pending" ? await issueGrant(tx, actorId, id, "activation") : null;
    return { id, name: person.name, email: person.email, grant: grant ? { url: grant.url, expiresAt: grant.expiresAt.toISOString() } : null };
  });
}

export async function removeAdministrator(actorId: string, id: string) {
  return db.transaction(async tx => {
    await owner(tx, actorId);
    await administrator(tx, actorId, id);
    await revokeAccess(tx, id);
    await tx.update(users).set({ role: "user", updatedAt: new Date() }).where(eq(users.id, id));
    return { id };
  });
}

export async function administratorAccessLink(actorId: string, id: string, purpose: unknown) {
  if (purpose !== "activation" && purpose !== "password_reset") throw new AdminError("Escolha uma finalidade válida.");
  return db.transaction(async tx => {
    await owner(tx, actorId);
    const person = await administrator(tx, actorId, id);
    if (person.status !== (purpose === "activation" ? "pending" : "active")) throw new AdminError("Não é possível criar este link para a conta selecionada.", 409);
    const grant = await issueGrant(tx, actorId, id, purpose);
    return { url: grant.url, expiresAt: grant.expiresAt.toISOString() };
  });
}

export async function revokeAdministratorLink(actorId: string, id: string, grantId: unknown) {
  if (typeof grantId !== "string" || !grantId) throw new AdminError("Escolha um link válido.");
  return db.transaction(async tx => {
    await owner(tx, actorId);
    await administrator(tx, actorId, id);
    const [grant] = await tx.select().from(invitations).where(and(eq(invitations.id, grantId), eq(invitations.userId, id))).limit(1);
    if (!grant) throw new AdminError("Link não encontrado.", 404);
    if (!grant.consumedAt && !grant.revokedAt) await tx.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, grant.id));
    return { id: grant.id };
  });
}
