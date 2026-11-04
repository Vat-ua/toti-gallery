export type FieldErrors = Record<string, string | undefined>;

/** Shared by runtime validators, API responses, and browser feedback. */
export class FormValidationError extends Error {
  constructor(public fieldErrors: FieldErrors) {
    super(Object.values(fieldErrors).find(Boolean) || "Revise os campos indicados.");
  }
}

export function rejectFields(errors: FieldErrors) {
  if (Object.values(errors).some(Boolean)) throw new FormValidationError(errors);
}

export function responseError(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const { fieldErrors, error } = data as Record<string, unknown>;
    if (fieldErrors && typeof fieldErrors === "object" && !Array.isArray(fieldErrors)) {
      const fields = Object.fromEntries(Object.entries(fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!entry[1]));
      if (Object.keys(fields).length) return new FormValidationError(fields);
    }
    if (typeof error === "string") return new Error(error);
  }
  return new Error(fallback);
}

export function httpsUrlError(value: unknown, github = false): string | undefined {
  if ((typeof value === "string" && !value.trim()) || value === null || value === undefined) return;
  try {
    if (typeof value !== "string" || value.trim().length > 2000) throw new Error();
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    if (github && !["github.com", "www.github.com"].includes(url.hostname)) throw new Error();
  } catch {
    return github ? "Informe um endereço do GitHub começando com https://." : "Informe um endereço válido começando com https://.";
  }
}

export function identityErrors(name: unknown, email: unknown): FieldErrors {
  return {
    name: typeof name !== "string" || name.trim().length < 2 || name.trim().length > 70 ? "Informe um nome de 2 a 70 caracteres." : undefined,
    email: typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Informe um email válido." : undefined,
  };
}

export function turmaErrors(data: Record<string, unknown>): FieldErrors {
  return {
    number: typeof data.number !== "number" || !Number.isInteger(data.number) || data.number < 1 || data.number > 999999999 ? "Informe um número de turma válido." : undefined,
    courseName: typeof data.courseName !== "string" || data.courseName.trim().length < 2 || data.courseName.trim().length > 100 ? "Informe o nome do curso, de 2 a 100 caracteres." : undefined,
    startYear: typeof data.startYear !== "number" || !Number.isInteger(data.startYear) || data.startYear < 2000 || data.startYear > 2100 ? "Informe o ano de início, de 2000 a 2100." : undefined,
  };
}
