export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export type ImageKind = "avatar" | "cover";
export type ImageMetadata = {
  key: string; width: number; height: number; bytes: number; format: "webp";
  thumbnail?: { key: string; width: number; height: number; bytes: number };
};

export function imageKey(value: string | null | undefined) {
  const match = /^\/media\/((?:avatars\/[a-f0-9-]{36}\.webp|covers\/[a-f0-9-]{36}\/(?:image|thumbnail)\.webp))$/.exec(value || "");
  return match?.[1] || null;
}

export function coverThumbnail(value: string) {
  return imageKey(value)?.startsWith("covers/") ? value.replace(/\/image\.webp$/, "/thumbnail.webp") : value;
}

export function validateImageFile(file: Pick<File, "type" | "size">) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if (!file.size || file.size > IMAGE_MAX_BYTES) throw new Error("A imagem deve ter até 3 MB.");
}
