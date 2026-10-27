import { adminMutation } from "@/lib/admin-http";
import { createStudentInvitations } from "@/lib/admin-students";

export async function POST(request: Request) {
  return adminMutation(request, async (actorId, body) => ({ invitations: await createStudentInvitations(actorId, body.userIds) }));
}
