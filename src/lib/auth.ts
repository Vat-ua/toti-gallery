import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuth } from "./auth-core";
import { authSettings } from "./auth-settings";
import { getPerson } from "./queries";

export async function getCurrentUser() {
  const session = await getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true, disableRefresh: true } });
  if (!session) return null;
  // Always check current DB state, independently of any session cache.
  const [account] = await db.select({ role: users.role, status: users.status, isDemo: users.isDemo }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!account || account.status !== "active" || account.isDemo) return null;
  const person = await getPerson(session.user.id);
  return person ? { ...person, role: account.role } : null;
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === authSettings().baseURL;
}
