import { adminMutation } from "@/lib/admin-http";
import { AdminError, archiveTurma, saveTurma } from "@/lib/admin-turmas";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, async (actorId, body) => {
    if (body.action === "archive" && typeof body.archived === "boolean") return archiveTurma(actorId, id, body.archived);
    if (body.action === "save") return saveTurma(actorId, { number: body.number, courseName: body.courseName, startYear: body.startYear }, id);
    throw new AdminError("Ação inválida.");
  });
}
