function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Os dados da conta são inválidos.");
  return value as Record<string, unknown>;
}

export function validateProfile(value: unknown, currentAvatar: string | null = null) {
  const body = record(value);
  if (Object.keys(body).some(key => !["name", "bio", "avatar", "github"].includes(key))) {
    throw new Error("Altere apenas o nome, a foto, a apresentação e o GitHub.");
  }
  if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 70) {
    throw new Error("O nome precisa ter entre 2 e 70 caracteres.");
  }
  if (typeof body.bio !== "string" || body.bio.trim().length > 600) throw new Error("A apresentação deve ter até 600 caracteres.");
  let github: string | null = null;
  if (body.github !== null && body.github !== "") {
    if (typeof body.github !== "string" || body.github.length > 2000) throw new Error("Informe um endereço válido do GitHub.");
    try {
      const url = new URL(body.github.trim());
      if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname) || url.username || url.password) throw new Error();
      github = url.href;
    } catch { throw new Error("Informe um endereço do GitHub começando com https://."); }
  }
  const avatar = body.avatar;
  // Keep the existing static/provider/data-URL photo; new files are multipart.
  if (avatar !== null && (typeof avatar !== "string" || avatar !== currentAvatar)) throw new Error("Envie uma nova foto pelo botão Alterar foto.");
  return { name: body.name.trim(), bio: body.bio.trim(), avatar, github };
}

export function validatePasswordChange(value: unknown) {
  const body = record(value);
  const { currentPassword, newPassword, confirmPassword } = body;
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128) throw new Error("Informe sua senha atual.");
  if (typeof newPassword !== "string" || newPassword.length < 15 || newPassword.length > 128) throw new Error("A nova senha precisa ter entre 15 e 128 caracteres.");
  if (newPassword !== confirmPassword) throw new Error("A confirmação não corresponde à nova senha.");
  if (newPassword === currentPassword) throw new Error("Escolha uma senha diferente da atual.");
  return { currentPassword, newPassword };
}
