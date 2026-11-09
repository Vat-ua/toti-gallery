import { requestJson } from "./http-client";
import type { ProfileSnapshot } from "./account";

export type ProfileInput = { name: string; bio: string; github: string; linkedin: string; avatar: string | null };
export type SavedProfile = ProfileSnapshot;
export type PasswordInput = { currentPassword: string; newPassword: string; confirmPassword: string };
const nullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

export async function updateAccountProfile(values: ProfileInput, expected: ProfileSnapshot, image?: File | null): Promise<SavedProfile> {
  const form = new FormData();
  form.set("data", JSON.stringify({ ...values, expected }));
  if (image) form.set("image", image);
  const fallback = "Não foi possível salvar seu perfil.";
  const data = await requestJson("/api/account", { method: "PATCH", body: form }, fallback);
  if (!data.user || typeof data.user !== "object" || Array.isArray(data.user)) throw new Error(fallback);
  const profile = data.user as Record<string, unknown>;
  if (typeof profile.name !== "string" || typeof profile.bio !== "string" || !nullableString(profile.avatar) || !nullableString(profile.github) || !nullableString(profile.linkedin)) throw new Error(fallback);
  return { name: profile.name, bio: profile.bio, avatar: profile.avatar, github: profile.github, linkedin: profile.linkedin };
}

export async function changeAccountPassword(values: PasswordInput): Promise<void> {
  const fallback = "Não foi possível alterar sua senha.";
  const data = await requestJson("/api/account/password", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
  }, fallback);
  if (!data.user || typeof data.user !== "object" || typeof (data.user as Record<string, unknown>).id !== "string" || !nullableString(data.token)) throw new Error(fallback);
}
