import { sql } from "drizzle-orm";
import { users } from "@/db/schema";

/** Literal substring search, matching the existing accent-insensitive UI. */
export function studentSearch(query: string) {
  const normalized = query.trim().slice(0, 254).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized ? sql`strpos(regexp_replace(normalize(lower(${users.name} || ' ' || ${users.email}), NFD), ${"[\u0300-\u036f]"}, '', 'g'), ${normalized}) > 0` : undefined;
}
