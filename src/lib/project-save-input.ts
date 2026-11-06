import { PublicError } from "./errors";

export function creationRequestId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new PublicError("Identificação do salvamento inválida. Reabra o formulário e tente novamente.");
  }
  return value.toLowerCase();
}

export function expectedProjectVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new PublicError("A versão do projeto é obrigatória. Reabra o editor e tente novamente.");
  }
  return value;
}
