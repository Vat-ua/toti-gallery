import { headers } from "next/headers";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { getAuth } from "./auth-core";
import { authSettings } from "./auth-settings";
import { getActiveAccountPerson } from "./queries";
import { PublicError } from "./errors";
import { errorDetails, logServerError } from "./server-log";

async function readIdentity<T>(operation: "auth.session" | "auth.account", read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    unstable_rethrow(error);
    const status = errorDetails(error).unavailable ? 503 : 500;
    const requestId = logServerError("auth.read.failed", error, { operation, status });
    const failure = new PublicError("Não foi possível verificar sua conta. Tente novamente.", status);
    failure.requestId = requestId;
    // Next also logs uncaught rendering errors. Do not forward the dependency
    // cause, SQL or session token to its formatter after recording safe details.
    throw failure;
  }
}

// React deduplicates only within a server render; mutations still check live DB state.
export const getCurrentSession = cache(async () =>
  readIdentity("auth.session", async () => getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true, disableRefresh: true } })));

export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession();
  if (!session) return null;
  // Keep live access checks; never authorize from a persistent cookie/user cache.
  return readIdentity("auth.account", () => getActiveAccountPerson(session.user.id));
});

/** Public pages need full account data only when showing this user's own controls. */
export async function isCurrentUser(userId: string) {
  const session = await getCurrentSession();
  return session?.user.id === userId && (await getCurrentUser())?.id === userId;
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === authSettings().baseURL;
}
