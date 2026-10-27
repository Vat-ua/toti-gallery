import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/db";
import { accounts, authSessions, invitations, users } from "@/db/schema";
import { authSettings } from "./auth-settings";
import { canManageAccount, isStaff } from "./permissions";

export class AccessError extends Error {
  constructor(message = "Este link é inválido, expirou ou já foi usado.") { super(message); }
}
export type AccessPurpose = "activation" | "password_reset";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const eligible = (user: { isDemo: boolean; status: string }) => !user.isDemo && user.status !== "suspended";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function inspectAccessLink(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new AccessError();
  const [result] = await db.select({ grant: invitations, user: users }).from(invitations).innerJoin(users, eq(users.id, invitations.userId))
    .where(and(eq(invitations.tokenHash, tokenHash(token)), gt(invitations.expiresAt, new Date()), isNull(invitations.consumedAt), isNull(invitations.revokedAt))).limit(1);
  if (!result || !eligible(result.user) || (result.grant.purpose === "activation" ? result.user.status !== "pending" : result.user.status !== "active")) throw new AccessError();
  return { userId: result.user.id, grantId: result.grant.id, email: result.user.email, purpose: result.grant.purpose, expiresAt: result.grant.expiresAt.toISOString() };
}

/** Trusted server primitive, shared with first-admin bootstrap. Caller holds user lock. */
export async function issueGrant(tx: Transaction, actorId: string, userId: string, purpose: AccessPurpose) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (purpose === "activation" ? 48 : 1) * 60 * 60_000);
  await tx.update(invitations).set({ revokedAt: now }).where(and(eq(invitations.userId, userId), eq(invitations.purpose, purpose), isNull(invitations.consumedAt), isNull(invitations.revokedAt)));
  const id = randomUUID();
  await tx.insert(invitations).values({ id, userId, createdBy: actorId, purpose, tokenHash: tokenHash(token), expiresAt, createdAt: now });
  return { id, url: `${authSettings().baseURL}/acesso#token=${token}`, expiresAt };
}

/** Creates a grant only. A delivery implementation receives the result separately. */
export async function createAccessLink(actorId: string, userId: string, purpose: AccessPurpose) {
  if (!["activation", "password_reset"].includes(purpose)) throw new AccessError("Finalidade inválida.");
  return db.transaction(async tx => {
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for("share").limit(1);
    if (!actor || !isStaff(actor.role) || actor.isDemo || actor.status !== "active") throw new AccessError("Acesso restrito à administração.");
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1);
    if (!user || !canManageAccount(actor, user) || !eligible(user) || (purpose === "activation" ? user.status !== "pending" : user.status !== "active")) throw new AccessError("Não é possível criar este link para a conta selecionada.");
    return issueGrant(tx, actorId, userId, purpose);
  });
}

export async function consumeAccessLink(token: unknown, password: unknown, confirmation: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new AccessError();
  if (typeof password !== "string" || password.length < 15 || password.length > 128) throw new AccessError("Use uma senha de 15 a 128 caracteres.");
  if (password !== confirmation) throw new AccessError("A confirmação não corresponde à senha.");
  const digest = tokenHash(token);
  // Check cheap invalid-token cases before running the password hash.
  const [grant] = await db.select({ userId: invitations.userId }).from(invitations).where(and(eq(invitations.tokenHash, digest), gt(invitations.expiresAt, new Date()), isNull(invitations.consumedAt), isNull(invitations.revokedAt))).limit(1);
  if (!grant) throw new AccessError();
  const passwordHash = await hashPassword(password);
  await db.transaction(async tx => {
    // All grants for one user serialize on this row, including Google activation.
    const [user] = await tx.select().from(users).where(eq(users.id, grant.userId)).for("update").limit(1);
    if (!user || !eligible(user)) throw new AccessError();
    const now = new Date();
    const [consumed] = await tx.update(invitations).set({ consumedAt: now }).where(and(eq(invitations.tokenHash, digest), gt(invitations.expiresAt, now), isNull(invitations.consumedAt), isNull(invitations.revokedAt))).returning();
    if (!consumed || (consumed.purpose === "activation" ? user.status !== "pending" : user.status !== "active")) throw new AccessError();
    await tx.insert(accounts).values({ id: randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: passwordHash }).onConflictDoUpdate({ target: [accounts.providerId, accounts.accountId], set: { password: passwordHash, updatedAt: now } });
    await tx.update(users).set({ status: "active", emailVerified: true, updatedAt: now }).where(eq(users.id, user.id));
    await tx.delete(authSessions).where(eq(authSessions.userId, user.id));
    await tx.update(invitations).set({ revokedAt: now }).where(and(eq(invitations.userId, user.id), ne(invitations.id, consumed.id), isNull(invitations.consumedAt), isNull(invitations.revokedAt)));
  });
}

/** Called only after Better Auth validates the Google response/token. No HTTP route. */
export async function admitGoogleIdentity(identity: { id?: unknown; email?: unknown; emailVerified?: unknown }, activation?: { userId: string; grantId: string }) {
  if (typeof identity.email !== "string" || identity.emailVerified !== true) return false;
  const email = identity.email.trim().toLowerCase();
  return db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.email, email)).for("update").limit(1);
    if (!user || !eligible(user) || (identity.id !== undefined && identity.id !== user.id)) return false;
    if (activation) {
      if (user.id !== activation.userId) return false;
      const [grant] = await tx.select({ id: invitations.id }).from(invitations).where(and(eq(invitations.id, activation.grantId), eq(invitations.userId, user.id), eq(invitations.purpose, "activation"), gt(invitations.expiresAt, new Date()), isNull(invitations.consumedAt), isNull(invitations.revokedAt))).limit(1);
      if (!grant || user.status !== "pending") return false;
    }
    if (user.status === "pending") {
      const now = new Date();
      await tx.update(users).set({ status: "active", emailVerified: true, updatedAt: now }).where(eq(users.id, user.id));
      await tx.update(invitations).set({ revokedAt: now }).where(and(eq(invitations.userId, user.id), eq(invitations.purpose, "activation"), isNull(invitations.consumedAt), isNull(invitations.revokedAt)));
    }
    return true;
  });
}
