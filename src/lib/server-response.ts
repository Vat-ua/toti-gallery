import { randomUUID } from "node:crypto";
import { PublicError } from "./errors";
import { FormValidationError } from "./form-validation";
import { BodyLimitError } from "./request-body";
import { errorDetails, logServerError } from "./server-log";

export function serverErrorResponse(error: unknown, fallback: string, operation: string) {
  const requestId = error instanceof PublicError && error.requestId && /^[a-f0-9-]{36}$/.test(error.requestId) ? error.requestId : randomUUID();
  const expected = error instanceof PublicError;
  const status = error instanceof FormValidationError ? 400 : error instanceof BodyLimitError ? 413
    : expected ? error.status : errorDetails(error).unavailable ? 503 : 500;
  const message = error instanceof FormValidationError || expected ? error.message
    : error instanceof BodyLimitError ? "Os dados excedem o limite permitido." : fallback;
  if (status >= 500) logServerError("request.failed", error, { operation, requestId, status });
  return Response.json({ error: message,
    ...(error instanceof FormValidationError ? { fieldErrors: error.fieldErrors } : {}),
    ...(status >= 500 ? { requestId } : {}),
  }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId, ...(status === 503 ? { "Retry-After": "5" } : {}) } });
}
