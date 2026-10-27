import { adminMutation } from "@/lib/admin-http";
import { moderateProject } from "@/lib/admin-projects";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return adminMutation(request, (actorId, body) => moderateProject(actorId, id, body.action, body.expectedVisibility, body.reason));
}
