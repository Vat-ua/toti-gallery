import { adminMutation } from "@/lib/admin-http";
import { AdminError } from "@/lib/admin-turmas";
import { administratorAccessLink, removeAdministrator, revokeAdministratorLink } from "@/lib/admin-administrators";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, async (actorId, body) => {
    if (body.action === "remove") return removeAdministrator(actorId, id);
    if (body.action === "access") return administratorAccessLink(actorId, id, body.purpose);
    if (body.action === "revoke-link") return revokeAdministratorLink(actorId, id, body.grantId);
    throw new AdminError("Ação inválida.");
  });
}
