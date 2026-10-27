import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listTurmas } from "@/lib/admin-turmas";
import { TurmasList } from "@/components/admin-turmas";
import { isStaff } from "@/lib/permissions";
export default async function TurmasPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/entrar?next=%2Fadmin%2Fturmas");
  if (!isStaff(actor.role)) notFound();
  return <TurmasList turmas={await listTurmas(actor.id)}/>;
}
