import { adminMutation } from "@/lib/admin-http";
import { AdminError, turmaAccessLink } from "@/lib/admin-turmas";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, async (actorId, body) => {
    if (typeof body.userId !== "string" || !["activation", "password_reset"].includes(String(body.purpose))) throw new AdminError("Escolha um estudante e uma finalidade.");
    return turmaAccessLink(actorId, id, body.userId, body.purpose);
  });
}
