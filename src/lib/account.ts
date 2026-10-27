function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Os dados da conta são inválidos.");
  return value as Record<string, unknown>;
}

export function validateProfile(value: unknown) {
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
  if (avatar !== null) {
    if (typeof avatar !== "string") throw new Error("A foto é inválida.");
    if (!/^\/images\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(avatar)) {
      if (avatar.length > 350_000) throw new Error("A foto processada deve ter até 256 KB.");
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(avatar);
      if (!match) throw new Error("Use uma foto JPG, PNG ou WebP.");
      const bytes = Buffer.from(match[2], "base64");
      const valid = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      if (!valid || bytes.length > 256 * 1024) throw new Error("A foto é inválida ou excede 256 KB após o processamento.");
    }
  }
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
