import { after } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { readImageForm } from "@/lib/image-form";
import { retireImage } from "@/lib/image-storage";
import { updateAccountProfile } from "@/lib/account-mutations";
import { serverErrorResponse } from "@/lib/server-response";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
    const result = await updateAccountProfile(user, await readImageForm(request, "avatar"));
    if (result.retired) after(() => retireImage(result.retired));
    return Response.json({ user: result.user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverErrorResponse(error, "Não foi possível salvar seu perfil. Tente novamente.", "account.profile");
  }
}
