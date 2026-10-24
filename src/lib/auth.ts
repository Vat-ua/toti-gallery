import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { Person } from "./types";

const COOKIE = "toti_session";
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export async function getCurrentUser(): Promise<Person | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const result = await db.select({ id: users.id, name: users.name, cohort: users.cohort, year: users.year, bio: users.bio, avatar: users.avatar, github: users.github }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.token, digest(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return result[0] || null;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token: digest(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, digest(token)));
  jar.delete(COOKIE);
}
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}
