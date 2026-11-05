// Server-side profile saving. actor comes only from the verified API session.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Person } from "./types";
import { validateProfile } from "./account";
import { getPerson } from "./queries";
import { ImageFormError } from "./image-form";
import { allowAttempt } from "./auth-rate-limit";
import { saveImage } from "./image-storage";
import { PublicError } from "./errors";
import { commitImageChange } from "./image-transaction";

export async function updateAccountProfile(actor: Pick<Person, "id" | "avatar">, { body, file }: { body: Record<string, unknown>; file: File | null }) {
  const profile = validateProfile(body, actor.avatar);
  let uploaded: Awaited<ReturnType<typeof saveImage>> | undefined;
  if (file) {
    if (!await allowAttempt("image-upload", actor.id, 20, 900)) throw new ImageFormError("Muitos envios. Aguarde alguns minutos.", 429);
    uploaded = await saveImage(file, "avatar");
  }
  return await commitImageChange(uploaded?.metadata, async tx => {
    const [current] = await tx.select({ avatar: users.image, metadata: users.imageMetadata, role: users.role }).from(users).where(eq(users.id, actor.id)).for("update").limit(1);
    if (!current) throw new PublicError("Perfil não encontrado.", 404);
    if (!uploaded && profile.avatar !== null && profile.avatar !== current.avatar) throw new PublicError("A foto mudou. Atualize a página e tente novamente.", 409);
    const { avatar, ...fields } = profile;
    const nextAvatar = uploaded?.url ?? avatar;
    await tx.update(users).set({ ...fields, image: nextAvatar, imageMetadata: uploaded?.metadata ?? (nextAvatar === current.avatar ? current.metadata : null), updatedAt: new Date() }).where(eq(users.id, actor.id));
    // Build the public result before commit, without re-authentication afterward.
    // Projection failures roll back the update and trigger uploaded-file cleanup.
    const person = await getPerson(actor.id, tx);
    if (!person) throw new Error("Perfil não encontrado.");
    return { user: { ...person, role: current.role }, retired: nextAvatar !== current.avatar ? current.metadata : null };
  });
}
