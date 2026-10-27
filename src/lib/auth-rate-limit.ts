import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

/** Shared durable limiter for custom endpoints and account-specific login attempts. */
export async function allowAttempt(scope: string, identity: string, max: number, windowSeconds: number) {
  const key = `${scope}:${createHash("sha256").update(identity).digest("hex")}`;
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;
  const [row] = await db.insert(rateLimits).values({ id: randomUUID(), key, count: 1, lastRequest: now }).onConflictDoUpdate({
    target: rateLimits.key,
    set: {
      count: sql`case when ${rateLimits.lastRequest} <= ${cutoff} then 1 else least(${rateLimits.count} + 1, 1000000) end`,
      lastRequest: sql`case when ${rateLimits.lastRequest} <= ${cutoff} then ${now} else ${rateLimits.lastRequest} end`,
    },
  }).returning({ count: rateLimits.count });
  return row.count <= max;
}

export function requestIP(request: Request) {
  // Vercel overwrites x-real-ip; do not trust a client-supplied forwarded chain.
  return request.headers.get("x-real-ip") || "local";
}
