import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser, isCurrentUser } from "./auth";
import { logServerError } from "./server-log";
import type { Person } from "./types";
import type { Role } from "./permissions";
import { PublicError } from "./errors";

/** Presentation only. Unavailable identity is neither a guest nor authorization. */
export type AuthenticationState = boolean | null;
export type PublicIdentity = { status: "ready"; user: (Person & { role?: Role }) | null }
  | { status: "unavailable"; user: null };

const recordFailure = cache((error: unknown) => {
  logServerError("auth.presentation.failed", error, { operation: "public.identity",
    requestId: error instanceof PublicError ? error.requestId : undefined,
    status: error instanceof PublicError ? error.status : undefined });
});

export const getPublicIdentity = cache(async (): Promise<PublicIdentity> => {
  try { return { status: "ready", user: await getCurrentUser() }; }
  catch (error) { unstable_rethrow(error); recordFailure(error); return { status: "unavailable", user: null }; }
});

/** Retain the narrow session/ownership reader; never expose edit controls on failure. */
export async function getPublicOwnership(id: string) {
  try { return await isCurrentUser(id); }
  catch (error) { unstable_rethrow(error); recordFailure(error); return false; }
}
