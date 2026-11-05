import { FormValidationError, responseError } from "./form-validation";

export class HttpError extends Error {
  constructor(message: string, public status: number, public data?: Record<string, unknown>) { super(message); }
}

/** Shared transport handling; UI decides how to display errors or handle 401. */
export async function requestJson(path: string, init: RequestInit, fallback: string): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetch(path, init); }
  catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error("Confira sua conexão e tente novamente.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = responseError(data, fallback);
    if (response.status !== 401 && error instanceof FormValidationError) throw error;
    throw new HttpError(error.message, response.status, data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : undefined);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(fallback);
  return data as Record<string, unknown>;
}
