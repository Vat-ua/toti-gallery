import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { validateProfile } from "@/lib/account";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  let profile;
  try { profile = validateProfile(await request.json()); }
  catch (error) { return Response.json({ error: error instanceof SyntaxError ? "Os dados da conta são inválidos." : error instanceof Error ? error.message : "Revise os dados do perfil." }, { status: 400 }); }
  try {
    const { avatar, ...fields } = profile;
    await db.update(users).set({ ...fields, image: avatar, updatedAt: new Date() }).where(eq(users.id, user.id));
    return Response.json({ user: await getCurrentUser() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao atualizar perfil", error);
    return Response.json({ error: "Não foi possível salvar seu perfil. Tente novamente." }, { status: 500 });
  }
}
