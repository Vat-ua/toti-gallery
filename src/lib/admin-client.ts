import { responseError } from "./form-validation";
// Shared browser-side request and presentation helpers for administration.
export async function request(path: string, body: unknown, method = "POST", signal?: AbortSignal) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok) throw responseError(data, "Não foi possível salvar. Tente novamente.");
  return data;
}
export const message = (error: unknown) => error instanceof TypeError ? "Confira sua conexão e tente novamente." : error instanceof Error ? error.message : "Confira sua conexão e tente novamente.";
export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const statusText = { pending: "Pendente", active: "Ativo", suspended: "Suspenso" };
