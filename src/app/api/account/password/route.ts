import { FormValidationError } from "@/lib/form-validation";
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
  catch (error) { if (error instanceof FormValidationError) return Response.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 }); return Response.json({ error: error instanceof Error ? error.message : "Revise os dados da senha." }, { status: 400 }); }
  const response = await getAuth().api.changePassword({ headers: await headers(), body: { ...data, revokeOtherSessions: true }, asResponse: true });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    return Response.json({ error: "Não foi possível alterar a senha. Tente novamente.",
      ...(result?.code === "INVALID_PASSWORD" ? { fieldErrors: { currentPassword: "A senha atual está incorreta." } } : {}),
    }, { status: response.status });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
