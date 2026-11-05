import { serverErrorResponse } from "./server-response";

/** Preserve field feedback/statuses while keeping SQL diagnostics out of HTTP. */
export function projectErrorResponse(error: unknown, fallback: string, operation = "project.mutation") {
  return serverErrorResponse(error, fallback, operation);
}
