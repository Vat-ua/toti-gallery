import { TECHNOLOGIES, COVER_STYLES } from "./types";
import { imageKey } from "./image-policy";
import { validateCoverFraming } from "./cover-framing";
import { FormValidationError, httpsUrlError, rejectFields, type FieldErrors } from "./form-validation";

export function validateCoauthorIds(body: Record<string, unknown>): string[] | undefined {
  if (body.coauthorIds === undefined) return undefined;
  if (!Array.isArray(body.coauthorIds) || body.coauthorIds.length > 200 || body.coauthorIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) {
    throw new FormValidationError({ coauthorIds: "A lista de coautores é inválida." });
  }
  return [...new Set(body.coauthorIds as string[])];
}

export function validateProjectTurma(value: unknown, allowedIds: readonly string[]) {
  if (!allowedIds.length) throw new FormValidationError({ turmaId: "Peça à administração para associar sua conta a uma turma antes de publicar." });
  const id = value === undefined ? allowedIds[0] : value;
  if (typeof id !== "string" || !allowedIds.includes(id)) throw new FormValidationError({ turmaId: "Selecione uma turma de que você participa." });
  return id;
}

export function validateProject(body: Record<string, unknown>, currentImage: string | null = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Os dados do projeto são inválidos.");
  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const title = text("title");
  const description = text("description");
  const errors: FieldErrors = {};
  if (title.length < 3 || title.length > 80) errors.title = "O título precisa ter entre 3 e 80 caracteres.";
  if (description.length < 30 || description.length > 6000) errors.description = "A descrição precisa ter entre 30 e 6.000 caracteres.";
  const technologies = Array.isArray(body.technologies) ? [...new Set(body.technologies.filter((item): item is string => typeof item === "string" && TECHNOLOGIES.includes(item)))] : [];
  if (!technologies.length || technologies.length > 8 || (Array.isArray(body.technologies) && body.technologies.some(item => typeof item !== "string" || !TECHNOLOGIES.includes(item)))) errors.technologies = "Selecione de 1 a 8 tecnologias.";
  if (body.isFinal !== undefined && typeof body.isFinal !== "boolean") errors.isFinal = "A indicação de projeto final deve ser verdadeira ou falsa.";
  if (body.turmaId !== undefined && (typeof body.turmaId !== "string" || !body.turmaId.trim() || body.turmaId.length > 200)) errors.turmaId = "Selecione uma turma válida.";
  if (body.imageUrl !== undefined && body.imageUrl !== null && typeof body.imageUrl !== "string") errors.imageUrl = "Envie a imagem pelo botão Enviar imagem.";
  const url = (key: string) => {
    const value = text(key);
    const error = httpsUrlError(body[key], key === "githubUrl");
    if (error) { errors[key] = error; return null; }
    if (!value) return null;
    return new URL(value).href;
  };
  const githubUrl = url("githubUrl");
  if (!text("githubUrl")) errors.githubUrl = "Informe o link do projeto no GitHub.";
  const image = text("imageUrl");
  let imageUrl: string | null = null;
  if (image) {
    if (image === currentImage) imageUrl = image;
    else {
      if (image.startsWith("data:") || imageKey(image)) errors.imageUrl = "Envie a imagem pelo botão Enviar imagem.";
      else {
        imageUrl = url("imageUrl");
        if (imageUrl && imageKey(new URL(imageUrl).pathname)) errors.imageUrl = "Envie sua própria imagem pelo botão Enviar imagem.";
      }
    }
  }
  const liveUrl = url("liveUrl");
  let coverFraming;
  try { coverFraming = validateCoverFraming(body.coverFraming); }
  catch (error) { errors.coverFraming = error instanceof Error ? error.message : "O enquadramento da capa é inválido."; }
  rejectFields(errors);
  return { title, description, technologies, isFinal: body.isFinal === true, coverStyle: COVER_STYLES.includes(text("coverStyle")) ? text("coverStyle") : "abstract", imageUrl, coverFraming, githubUrl: githubUrl!, liveUrl };
}
