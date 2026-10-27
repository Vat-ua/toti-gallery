import { adminMutation } from "@/lib/admin-http";
import { AdminError, setMembership, lookupStudent, addStudent, findStudentCandidates } from "@/lib/admin-turmas";
async function handle(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, async (actorId, body) => {
    if (request.method === "POST" && body.action === "candidates" && typeof body.query === "string") return { candidates: await findStudentCandidates(actorId, id, body.query) };
    if (request.method === "POST" && body.action === "lookup" && typeof body.email === "string") return { student: await lookupStudent(actorId, id, body.email) };
    if (request.method === "POST" && body.action === "add" && typeof body.email === "string" && typeof body.name === "string") return addStudent(actorId, id, body.name, body.email);
    if (typeof body.userId !== "string") throw new AdminError("Escolha um estudante.");
    return setMembership(actorId, id, body.userId, request.method === "POST");
  });
}
export const POST = handle;
export const DELETE = handle;
