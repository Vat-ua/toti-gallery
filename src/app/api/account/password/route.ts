import { headers } from "next/headers";
import { getAuth } from "@/lib/auth-core";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { validatePasswordChange } from "@/lib/account";
import { allowAttempt } from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  if (!await allowAttempt("change-password", user.id, 10, 900)) return Response.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429, headers: { "Retry-After": "900" } });
  let data;
  try { data = validatePasswordChange(await request.json()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Revise os dados da senha." }, { status: 400 }); }
  const response = await getAuth().api.changePassword({ headers: await headers(), body: { ...data, revokeOtherSessions: true }, asResponse: true });
  if (!response.ok) return Response.json({ error: "Não foi possível alterar a senha. Confira a senha atual." }, { status: response.status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
