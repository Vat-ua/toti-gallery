import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminError, turmaDetails } from "@/lib/admin-turmas";
import { TurmaDetail } from "@/components/admin-turmas";
import { isStaff } from "@/lib/permissions";
export default async function TurmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) redirect(`/entrar?next=${encodeURIComponent(`/admin/turmas/${id}`)}`);
  if (!isStaff(actor.role)) notFound();
  const details = await turmaDetails(actor.id, id).catch(error => {
    if (error instanceof AdminError && error.status === 404) notFound();
    throw error;
  });
  return <TurmaDetail {...details} owner={actor.role === "owner"}/>;
}
