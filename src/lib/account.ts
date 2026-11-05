import { httpsUrlError, rejectFields, type FieldErrors } from "./form-validation";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Os dados da conta são inválidos.");
  return value as Record<string, unknown>;
}

export function validateProfile(value: unknown, currentAvatar: string | null = null) {
  const body = record(value);
  if (Object.keys(body).some(key => !["name", "bio", "avatar", "github", "linkedin"].includes(key))) {
    throw new Error("Altere apenas os dados do seu perfil.");
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
