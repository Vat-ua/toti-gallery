import { eq } from "drizzle-orm";
import type { db } from "@/db";
import { users } from "@/db/schema";
import { isStaff } from "./permissions";

export class AdminError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type AdminTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function staff(tx: AdminTransaction, actorId: string, targetId?: string) {
  // Self-management needs the stronger lock from the outset. Two shared locks
  // followed by upgrades on the same actor can otherwise deadlock.
  const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for(targetId === actorId ? "update" : "share").limit(1);
  if (!actor || !isStaff(actor.role) || actor.isDemo || actor.status !== "active") throw new AdminError("Acesso restrito à administração.", 403);
  return actor;
}
