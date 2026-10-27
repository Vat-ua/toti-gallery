import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { turmaMembers, turmas, users } from "@/db/schema";
import { AccessError, issueGrant } from "./access-links";
import { isStaff } from "./permissions";

export function provisionIdentity(name: string, email: string) {
  name = name.trim(); email = email.trim().toLowerCase();
  if (name.length < 2 || name.length > 70 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccessError("Informe um nome e email válidos.");
  return { name, email };
}

/** Offline, trusted operation only; never expose this through an HTTP endpoint. */
export async function bootstrapAdmin(name: string, email: string) {
  const identity = provisionIdentity(name, email);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gallery-first-admin'))`);
    const admins = await tx.select().from(users).where(inArray(users.role, ["admin", "owner"])).for("update");
    if (admins.length) {
      // Allow recovery of a lost first-activation link, never promotion/takeover.
      if (admins.length === 1 && admins[0].email === identity.email && admins[0].status === "pending" && !admins[0].isDemo) return issueGrant(tx, admins[0].id, admins[0].id, "activation");
      throw new AccessError("Já existe uma conta administradora. O bootstrap está encerrado.");
    }
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, identity.email)).limit(1);
    if (existing) throw new AccessError("Este email já pertence a um perfil. O bootstrap não promove contas existentes.");
    const id = randomUUID();
    await tx.insert(users).values({ ...identity, id, role: "owner", status: "pending" });
    return issueGrant(tx, id, id, "activation");
  });
}

/** Single-user provisioning used by the pilot CLI; batch/admin UI is stage 3. */
export async function provisionStudent(actorId: string, name: string, email: string, turmaId: string) {
  const identity = provisionIdentity(name, email);
  return db.transaction(async tx => {
    const [actor] = await tx.select().from(users).where(and(eq(users.id, actorId), eq(users.status, "active"), eq(users.isDemo, false))).for("share").limit(1);
    if (!actor || !isStaff(actor.role)) throw new AccessError("Acesso restrito à administração.");
    const [turma] = await tx.select({ id: turmas.id }).from(turmas).where(eq(turmas.id, turmaId)).limit(1);
    if (!turma) throw new AccessError("Turma não encontrada.");
    // Serialize duplicate imports before relying on the database unique index.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${identity.email}))`);
    let [user] = await tx.select().from(users).where(eq(users.email, identity.email)).for("update").limit(1);
    if (user && (user.isDemo || user.status === "suspended" || user.role !== "user")) throw new AccessError("Este perfil não pode ser usado para ativação.");
    if (!user) [user] = await tx.insert(users).values({ id: randomUUID(), ...identity }).returning();
    await tx.insert(turmaMembers).values({ turmaId, userId: user.id }).onConflictDoNothing();
    return { id: user.id, status: user.status };
  });
}
