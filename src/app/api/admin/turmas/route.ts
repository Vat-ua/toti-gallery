import { adminMutation } from "@/lib/admin-http";
import { saveTurma } from "@/lib/admin-turmas";
export async function POST(request: Request) {
  return adminMutation(request, (actorId, body) => saveTurma(actorId, body));
}
