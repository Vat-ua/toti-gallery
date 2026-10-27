import { adminMutation } from "@/lib/admin-http";
import { AdminError } from "@/lib/admin-turmas";
import { deletePendingStudent, revokeStudentLink, setStudentSuspended, studentAccessLink, updateStudentProfile, updateStudentTurmas } from "@/lib/admin-students";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, async (actorId, body) => {
    if (body.action === "profile") return updateStudentProfile(actorId, id, body.name, body.email);
    if (body.action === "delete") return deletePendingStudent(actorId, id);
    if (body.action === "turmas") return updateStudentTurmas(actorId, id, body.turmaIds);
    if (body.action === "suspend" && typeof body.suspended === "boolean") return setStudentSuspended(actorId, id, body.suspended);
    if (body.action === "access") return studentAccessLink(actorId, id, body.purpose);
    if (body.action === "revoke-link") return revokeStudentLink(actorId, id, body.grantId);
    throw new AdminError("Ação inválida.");
  });
}
