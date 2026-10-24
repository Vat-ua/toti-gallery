import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { createSession, destroySession, getCurrentUser, isSameOrigin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ensureSeed } from "@/lib/seed";
import { COHORTS } from "@/lib/types";

const attempts = new Map<string, { count: number; until: number }>();
export async function GET() { return Response.json({ user: await getCurrentUser() }); }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  try {
    const body = await request.json();
    if (body.action === "logout") { await destroySession(); return Response.json({ ok: true }); }
    if (!["login", "register"].includes(body.action)) return Response.json({ error: "Ação inválida." }, { status: 400 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const previous = attempts.get(ip);
    const limit = previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 60000 };
    if (++limit.count > 30) return Response.json({ error: "Muitas tentativas. Aguarde um minuto e tente novamente." }, { status: 429 });
    attempts.set(ip, limit);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128) return Response.json({ error: "Informe um e-mail válido e uma senha entre 8 e 128 caracteres." }, { status: 400 });
    await ensureSeed();
    const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    let userId: string;
    if (body.action === "login") {
      if (!existing || !(await verifyPassword(password, existing.passwordHash))) return Response.json({ error: "E-mail ou senha incorretos. Tente novamente." }, { status: 401 });
      userId = existing.id;
    } else {
      if (existing) return Response.json({ error: "Este e-mail já tem uma conta. Entre para continuar." }, { status: 409 });
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const cohort = typeof body.cohort === "string" ? body.cohort : "";
      const year = Number(body.year);
      if (name.length < 2 || name.length > 70 || !COHORTS.includes(cohort) || !Number.isInteger(year) || year < 2020 || year > 2030) return Response.json({ error: "Preencha seu nome, sua turma e um ano válido." }, { status: 400 });
      userId = randomUUID();
      await db.insert(users).values({ id: userId, name, email, passwordHash: await hashPassword(password), cohort, year });
    }
    await createSession(userId);
    return Response.json({ user: await getCurrentUser() });
  } catch (error) {
    console.error("Falha na autenticação", error);
    return Response.json({ error: "Não foi possível continuar. Tente novamente em instantes." }, { status: 500 });
  }
}
