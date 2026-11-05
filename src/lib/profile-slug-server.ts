import { eq, sql } from "drizzle-orm";
import type { db } from "@/db";
import { users } from "@/db/schema";
import { profileSlugBase } from "./profile-slug";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function allocateProfileSlug(tx: Transaction, name: string) {
  // Serialize short profile-creation transactions, including collisions between
  // a name such as "Ana 2" and a suffix already allocated for "Ana".
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gallery-profile-slugs'))`);
  const base = profileSlugBase(name);
  let slug = base, suffix = 1;
  while ((await tx.select({ id: users.id }).from(users).where(eq(users.slug, slug)).limit(1)).length) {
    slug = `${base}-${++suffix}`;
  }
  return slug;
}
