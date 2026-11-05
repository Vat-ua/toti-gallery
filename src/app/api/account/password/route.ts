import { headers } from "next/headers";
import { getAuth } from "@/lib/auth-core";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { validatePasswordChange } from "@/lib/account";
import { allowAttempt } from "@/lib/auth-rate-limit";
import { readJsonBody } from "@/lib/request-body";
import { serverErrorResponse } from "@/lib/server-response";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
    if (!await allowAttempt("change-password", user.id, 10, 900)) return Response.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429, headers: { "Retry-After": "900" } });
    // JSON escaping can expand a valid 128-character password; still bound the bytes.
    const data = validatePasswordChange(await readJsonBody(request, 8192));
    const response = await getAuth().api.changePassword({ headers: await headers(), body: { ...data, revokeOtherSessions: true }, asResponse: true });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      if (response.status >= 500) return serverErrorResponse(new Error("Auth password operation failed"), "Não foi possível alterar a senha. Tente novamente.", "account.password");
      return Response.json({ error: "Não foi possível alterar a senha. Tente novamente.",
        ...(result?.code === "INVALID_PASSWORD" ? { fieldErrors: { currentPassword: "A senha atual está incorreta." } } : {}),
      }, { status: response.status, headers: { "Cache-Control": "no-store" } });
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return serverErrorResponse(error, "Não foi possível alterar a senha. Tente novamente.", "account.password"); }
}
