import { adminMutation } from "@/lib/admin-http";
import { AdminError, turmaDetails } from "@/lib/admin-turmas";
import { AccessError, createAccessLink } from "@/lib/access-links";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, async (actorId, body) => {
    if (typeof body.userId !== "string" || !["activation", "password_reset"].includes(String(body.purpose))) throw new AdminError("Escolha um estudante e uma finalidade.");
    const details = await turmaDetails(actorId, id);
    if (!details.members.some(m => m.id === body.userId)) throw new AdminError("Estudante não encontrado nesta turma.", 404);
    try {
      const grant = await createAccessLink(actorId, body.userId, body.purpose as "activation" | "password_reset");
      return { url: grant.url, expiresAt: grant.expiresAt.toISOString() };
    } catch (error) {
      if (error instanceof AccessError) throw new AdminError(error.message);
      throw error;
    }
  });
}
