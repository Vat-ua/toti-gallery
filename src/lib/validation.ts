import { TECHNOLOGIES, COVER_STYLES } from "./types";
import { imageKey } from "./image-policy";
import { validateCoverFraming } from "./cover-framing";

export function validateCoauthorIds(body: Record<string, unknown>): string[] | undefined {
  if (body.coauthorIds === undefined) return undefined;
  if (!Array.isArray(body.coauthorIds) || body.coauthorIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) {
    throw new Error("A lista de coautores é inválida.");
  }
  return [...new Set(body.coauthorIds as string[])];
}

export function validateProject(body: Record<string, unknown>, currentImage: string | null = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Os dados do projeto são inválidos.");
  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const title = text("title");
  const description = text("description");
  if (title.length < 3 || title.length > 80) throw new Error("O título precisa ter entre 3 e 80 caracteres.");
  if (description.length < 30 || description.length > 6000) throw new Error("A descrição precisa ter entre 30 e 6.000 caracteres.");
  const technologies = Array.isArray(body.technologies) ? [...new Set(body.technologies.filter((item): item is string => typeof item === "string" && TECHNOLOGIES.includes(item)))] : [];
  if (!technologies.length || technologies.length > 8) throw new Error("Selecione de 1 a 8 tecnologias.");
  if (body.isFinal !== undefined && typeof body.isFinal !== "boolean") throw new Error("A indicação de projeto final deve ser verdadeira ou falsa.");
  const url = (key: string) => {
    const value = text(key);
    if (!value) return null;
    try { const parsed = new URL(value); if (!["https:", "http:"].includes(parsed.protocol) || value.length > 2000) throw new Error(); return parsed.href; }
    catch { throw new Error("Os links precisam ser endereços válidos, começando com https://."); }
  };
  const githubUrl = url("githubUrl");
  if (!githubUrl) throw new Error("Informe o link do projeto no GitHub.");
  if (!["github.com", "www.github.com"].includes(new URL(githubUrl).hostname)) throw new Error("Informe um endereço válido do GitHub.");
  const image = text("imageUrl");
  let imageUrl: string | null = null;
  if (image) {
    if (image === currentImage) imageUrl = image;
    else {
      if (image.startsWith("data:") || imageKey(image)) throw new Error("Envie a imagem pelo botão Enviar imagem.");
      imageUrl = url("imageUrl");
      if (imageUrl && imageKey(new URL(imageUrl).pathname)) throw new Error("Envie sua própria imagem pelo botão Enviar imagem.");
    }
  }
  return { title, description, technologies, isFinal: body.isFinal === true, coverStyle: COVER_STYLES.includes(text("coverStyle")) ? text("coverStyle") : "abstract", imageUrl, coverFraming: validateCoverFraming(body.coverFraming), githubUrl, liveUrl: url("liveUrl") };
}
