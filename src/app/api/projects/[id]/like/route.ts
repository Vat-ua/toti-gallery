import { db } from "@/db";
import { likes, projects } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { isSameOrigin } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const { id } = await params;
  const project = (await db.select({ base: projects.baseLikes }).from(projects).where(eq(projects.id, id)).limit(1))[0];
  if (!project) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
  const jar = await cookies();
  const existingKey = jar.get("toti_visitor")?.value;
  const visitorKey = existingKey && /^[a-z0-9-]{36}$/.test(existingKey) ? existingKey : randomUUID();
  const where = and(eq(likes.projectId, id), eq(likes.visitorKey, visitorKey));
  const existing = await db.select().from(likes).where(where);
  if (existing.length) await db.delete(likes).where(where);
  else await db.insert(likes).values({ projectId: id, visitorKey }).onConflictDoNothing();
  jar.set("toti_visitor", visitorKey, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  const totals = await db.select({ total: count() }).from(likes).where(eq(likes.projectId, id));
  return Response.json({ liked: !existing.length, likes: project.base + totals[0].total });
}
