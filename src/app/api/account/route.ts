import { FormValidationError } from "@/lib/form-validation";
import { after } from "next/server";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { ImageFormError, readImageForm } from "@/lib/image-form";
import { retireImage } from "@/lib/image-storage";
import { updateAccountProfile } from "@/lib/account-mutations";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  try {
    const result = await updateAccountProfile(user, await readImageForm(request, "avatar"));
    if (result.retired) after(() => retireImage(result.retired));
    return Response.json({ user: result.user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FormValidationError) return Response.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 });
    const message = error instanceof Error && !("query" in error) ? error.message : "Não foi possível salvar seu perfil. Tente novamente.";
    return Response.json({ error: message }, { status: error instanceof ImageFormError ? error.status : 400 });
  }
}
