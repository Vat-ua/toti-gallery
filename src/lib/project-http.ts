import { FormValidationError } from "./form-validation";
import { ImageFormError } from "./image-form";
import { ProjectMutationError } from "./project-mutations";

/** Preserve field feedback/statuses while keeping SQL diagnostics out of HTTP. */
export function projectErrorResponse(error: unknown, fallback: string) {
  if (error instanceof FormValidationError) return Response.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 });
  const message = error instanceof Error && !("query" in error) ? error.message : fallback;
  const status = error instanceof ImageFormError || error instanceof ProjectMutationError ? error.status : 400;
  return Response.json({ error: message }, { status });
}
