import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "./auth-core";
import { authSettings } from "./auth-settings";
import { getActiveAccountPerson } from "./queries";

// React deduplicates only within a server render; mutations still check live DB state.
export const getCurrentSession = cache(async () =>
  getAuth().api.getSession({ headers: await headers(), query: { disableCookieCache: true, disableRefresh: true } }));

export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession();
  if (!session) return null;
  // Keep live access checks; never authorize from a persistent cookie/user cache.
  return getActiveAccountPerson(session.user.id);
});

/** Public pages need full account data only when showing this user's own controls. */
export async function isCurrentUser(userId: string) {
  const session = await getCurrentSession();
  return session?.user.id === userId && (await getCurrentUser())?.id === userId;
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === authSettings().baseURL;
}
