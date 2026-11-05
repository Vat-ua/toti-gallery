import { eq, like, or, sql } from "drizzle-orm";
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

/** Reserve batch slugs under the same lock used by individual provisioning. */
export async function allocateProfileSlugs(tx: Transaction, names: string[]) {
  if (!names.length) return [];
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('gallery-profile-slugs'))`);
  const bases = [...new Set(names.map(profileSlugBase))];
  const existing = await tx.select({ slug: users.slug }).from(users).where(or(...bases.map(base => or(eq(users.slug, base), like(users.slug, `${base}-%`)))));
  const reserved = new Set(existing.map(row => row.slug));
  return names.map(name => {
    const base = profileSlugBase(name);
    let slug = base, suffix = 1;
    while (reserved.has(slug)) slug = `${base}-${++suffix}`;
    reserved.add(slug);
    return slug;
  });
}
