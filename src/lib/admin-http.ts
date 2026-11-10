import { FormValidationError } from "./form-validation";
import { getCurrentUser, isSameOrigin } from "./auth";
import { isStaff } from "./permissions";
import { AdminError } from "./admin-server";
import { readJsonBody } from "./request-body";
import { serverErrorResponse } from "./server-response";

const diagnosticActions: Record<string, readonly string[]> = {
  turmas: ["save", "archive", "candidates", "lookup", "add", "preview", "confirm"],
  estudantes: ["profile", "delete", "turmas", "suspend", "access", "revoke-link"],
  projetos: ["hide", "restore"],
  administradores: ["create", "promote", "remove", "access", "revoke-link"],
};

export async function adminMutation(request: Request, action: (actorId: string, body: Record<string, unknown>) => Promise<unknown>) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403, headers });
  const area = new URL(request.url).pathname.split("/")[3];
  const knownArea = Object.hasOwn(diagnosticActions, area);
  let operation = knownArea ? `admin.${area}` : "admin.mutation";
  try {
    const actor = await getCurrentUser();
    if (!actor) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401, headers });
    if (!isStaff(actor.role)) return Response.json({ error: "Acesso restrito à administração." }, { status: 403, headers });
    const body = await readJsonBody(request, 250_000);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminError("Dados inválidos.");
    const requestedAction = (body as Record<string, unknown>).action;
    if (knownArea && typeof requestedAction === "string" && diagnosticActions[area].includes(requestedAction)) operation += `.${requestedAction}`;
    const result = await action(actor.id, body as Record<string, unknown>);
    return Response.json(result || { ok: true }, { headers });
  } catch (error) {
    if (error instanceof FormValidationError) return Response.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400, headers });
    if (error instanceof AdminError) return Response.json({ error: error.message }, { status: error.status, headers });
    const failure = error as { cause?: { code?: string; constraint?: string }; code?: string; constraint?: string } | null;
    const detail = failure?.cause || failure;
    if (detail?.code === "23505") {
      const constraint = detail.constraint || "";
      const text = ["gallery_users_email_unique", "gallery_users_email_normalized_idx"].includes(constraint) ? "Este email já está cadastrado em outro perfil."
        : ["gallery_turmas_number_idx", "gallery_turmas_name_normalized_idx", "gallery_turmas_name_unique"].includes(constraint) ? "Este número de turma já está cadastrado. Confira também as turmas arquivadas."
        : "Já existe um cadastro com estes dados. Atualize a página e tente novamente.";
      return Response.json({ error: text }, { status: 409, headers });
    }
    return serverErrorResponse(error, "Não foi possível salvar. Tente novamente.", operation);
  }
}
