import { getCurrentUser, isSameOrigin } from "./auth";
import { isStaff } from "./permissions";
import { AdminError } from "./admin-turmas";

export async function adminMutation(request: Request, action: (actorId: string, body: Record<string, unknown>) => Promise<unknown>) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403, headers });
  const actor = await getCurrentUser();
  if (!actor) return Response.json({ error: "Entre na sua conta para continuar." }, { status: 401, headers });
  if (!isStaff(actor.role)) return Response.json({ error: "Acesso restrito à administração." }, { status: 403, headers });
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 250_000) throw new AdminError("Os dados excedem o limite permitido.", 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminError("Dados inválidos.");
    const result = await action(actor.id, body);
    return Response.json(result || { ok: true }, { headers });
  } catch (error) {
    if (error instanceof AdminError) return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof SyntaxError) return Response.json({ error: "Dados inválidos." }, { status: 400, headers });
    const code = (error as { cause?: { code?: string }; code?: string }).cause?.code || (error as { code?: string }).code;
    if (code === "23505") return Response.json({ error: "Este número de turma ou email já está cadastrado. Confira também as turmas arquivadas." }, { status: 409, headers });
    return Response.json({ error: "Não foi possível salvar. Tente novamente." }, { status: 500, headers });
  }
}
