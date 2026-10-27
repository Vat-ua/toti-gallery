import { adminMutation } from "@/lib/admin-http";
import { AdminError, importStudents } from "@/lib/admin-turmas";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, (actorId, body) => {
    if (typeof body.text !== "string" || !["preview", "confirm"].includes(String(body.action))) throw new AdminError("Lista inválida.");
    if (body.excluded !== undefined && (!Array.isArray(body.excluded) || body.excluded.length > 500 || body.excluded.some(x => !Number.isInteger(x)))) throw new AdminError("Seleção inválida.");
    return importStudents(actorId, id, body.text, (body.excluded || []) as number[], body.action === "confirm");
  });
}
