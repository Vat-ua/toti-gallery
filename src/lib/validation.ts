import { TECHNOLOGIES, COVER_STYLES } from "./types";

export function validateCoauthorIds(body: Record<string, unknown>): string[] | undefined {
  if (body.coauthorIds === undefined) return undefined;
  if (!Array.isArray(body.coauthorIds) || body.coauthorIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) {
    throw new Error("A lista de coautores é inválida.");
  }
  return [...new Set(body.coauthorIds as string[])];
}

export function validateProject(body: Record<string, unknown>) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Os dados do projeto são inválidos.");
  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const title = text("title");
  const summary = text("summary");
  const description = text("description");
  if (title.length < 3 || title.length > 80) throw new Error("O título precisa ter entre 3 e 80 caracteres.");
  if (summary.length < 10 || summary.length > 140) throw new Error("O resumo precisa ter entre 10 e 140 caracteres.");
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
  const image = text("imageUrl");
  if (image.length > 2_900_000) throw new Error("A imagem deve ter até 2 MB.");
  let imageUrl: string | null = null;
  if (image) {
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) imageUrl = image;
    else { imageUrl = url("imageUrl"); }
  }
  return { title, summary, description, technologies, isFinal: body.isFinal === true, coverStyle: COVER_STYLES.includes(text("coverStyle")) ? text("coverStyle") : "abstract", imageUrl, githubUrl: url("githubUrl"), liveUrl: url("liveUrl") };
}
