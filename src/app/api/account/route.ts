import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { validateProfile } from "@/lib/account";
import { ImageFormError, readImageForm } from "@/lib/image-form";
import { deleteImage, retireImage, saveImage } from "@/lib/image-storage";
import { allowAttempt } from "@/lib/auth-rate-limit";

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  let uploaded: Awaited<ReturnType<typeof saveImage>> | undefined;
  let committed = false;
  try {
    const { body, file } = await readImageForm(request);
    const profile = validateProfile(body, user.avatar);
    if (file) {
      if (!await allowAttempt("image-upload", user.id, 20, 900)) throw new ImageFormError("Muitos envios. Aguarde alguns minutos.", 429);
      uploaded = await saveImage(file, "avatar");
    }
    const previous = await db.transaction(async tx => {
      const [current] = await tx.select({ avatar: users.image, metadata: users.imageMetadata }).from(users).where(eq(users.id, user.id)).for("update").limit(1);
      if (!current) throw new Error("Perfil não encontrado.");
      if (!uploaded && profile.avatar !== null && profile.avatar !== current.avatar) throw new Error("A foto mudou. Atualize a página e tente novamente.");
      const { avatar, ...fields } = profile;
      const nextAvatar = uploaded?.url ?? avatar;
      await tx.update(users).set({ ...fields, image: nextAvatar, imageMetadata: uploaded?.metadata ?? (nextAvatar === current.avatar ? current.metadata : null), updatedAt: new Date() }).where(eq(users.id, user.id));
      return nextAvatar !== current.avatar ? current.metadata : null;
    });
    committed = true;
    if (previous) after(() => retireImage(previous));
    return Response.json({ user: await getCurrentUser() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploaded && !committed) await deleteImage(uploaded.metadata);
    const message = error instanceof Error && !("query" in error) ? error.message : "Não foi possível salvar seu perfil. Tente novamente.";
    return Response.json({ error: message }, { status: error instanceof ImageFormError ? error.status : 400 });
  }
}
