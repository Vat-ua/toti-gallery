import { httpsUrlError, rejectFields, type FieldErrors } from "./form-validation";
import { PublicError } from "./errors";
import type { Person } from "./types";

export type ProfileSnapshot = Pick<Person, "name" | "bio" | "avatar" | "github" | "linkedin">;

/** Exact editable values from the opened form; no auth/membership timestamps. */
export function profileSnapshot(value: ProfileSnapshot): ProfileSnapshot {
  return { name: value.name, bio: value.bio, avatar: value.avatar, github: value.github, linkedin: value.linkedin };
}

export function readProfileSnapshot(value: unknown): ProfileSnapshot {
  const data = record(value);
  if (Object.keys(data).some(key => !["name", "bio", "avatar", "github", "linkedin"].includes(key))
    || typeof data.name !== "string" || typeof data.bio !== "string"
    || [data.avatar, data.github, data.linkedin].some(field => field !== null && typeof field !== "string")) {
    throw new PublicError("Confira os dados iniciais do perfil. Atualize a página e tente novamente.");
  }
  // Shape validation only: an existing legacy value must remain comparable even
  // when it would not pass today's new-input policy. Never normalize the snapshot.
  return profileSnapshot(data as ProfileSnapshot);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PublicError("Os dados da conta são inválidos.");
  return value as Record<string, unknown>;
}

export function validateProfile(value: unknown, currentAvatar: string | null = null) {
  const body = record(value);
  if (Object.keys(body).some(key => !["name", "bio", "avatar", "github", "linkedin"].includes(key))) {
    throw new PublicError("Altere apenas os dados do seu perfil.");
  }
  const errors: FieldErrors = {};
  if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 70) errors.name = "O nome precisa ter entre 2 e 70 caracteres.";
  if (typeof body.bio !== "string" || body.bio.trim().length > 600) errors.bio = "A apresentação deve ter até 600 caracteres.";
  errors.github = httpsUrlError(body.github, true);
  errors.linkedin = httpsUrlError(body.linkedin);
  if (!errors.linkedin && typeof body.linkedin === "string" && body.linkedin.trim()) {
    const host = new URL(body.linkedin.trim()).hostname;
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) errors.linkedin = "Informe um endereço do LinkedIn começando com https://.";
  }
  if (errors.linkedin) errors.linkedin = "Informe um endereço do LinkedIn começando com https://.";
  const avatar = body.avatar;
  // Keep the existing static/provider/data-URL photo; new files are multipart.
  if (avatar !== null && (typeof avatar !== "string" || avatar !== currentAvatar)) errors.avatar = "Envie uma nova foto pelo botão Alterar foto.";
  rejectFields(errors);
  const github = typeof body.github === "string" && body.github.trim() ? new URL(body.github.trim()).href : null;
  const linkedin = typeof body.linkedin === "string" && body.linkedin.trim() ? new URL(body.linkedin.trim()).href : null;
  return { name: (body.name as string).trim(), bio: (body.bio as string).trim(), avatar: avatar as string | null, github, linkedin };
}

export function validatePasswordChange(value: unknown) {
  const body = record(value);
  const { currentPassword, newPassword, confirmPassword } = body;
  const errors: FieldErrors = {};
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128) errors.currentPassword = "Informe sua senha atual.";
  if (typeof newPassword !== "string" || newPassword.length < 15 || newPassword.length > 128) errors.newPassword = "A nova senha precisa ter entre 15 e 128 caracteres.";
  if (typeof confirmPassword !== "string" || !confirmPassword || newPassword !== confirmPassword) errors.confirmPassword = "A confirmação não corresponde à nova senha.";
  if (typeof newPassword === "string" && newPassword === currentPassword) errors.newPassword = "Escolha uma senha diferente da atual.";
  rejectFields(errors);
  return { currentPassword: currentPassword as string, newPassword: newPassword as string };
}
