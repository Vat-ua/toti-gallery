import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminError, turmaDetails } from "@/lib/admin-turmas";
import { TurmaDetail } from "@/components/admin-turmas";
import { isStaff } from "@/lib/permissions";
import { AdminProjects } from "@/components/admin-projects";
import { listAdminProjects } from "@/lib/admin-projects";
import { adminProjectHref, parseAdminProjectFilters } from "@/lib/admin-project-params";
export default async function TurmaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) redirect(`/entrar?next=${encodeURIComponent(`/admin/turmas/${id}`)}`);
  if (!isStaff(actor.role)) notFound();
  const details = await turmaDetails(actor.id, id).catch(error => {
    if (error instanceof AdminError && error.status === 404) notFound();
    throw error;
  });
  const query = await searchParams;
  let projectContent = null;
  if (query.tab === "projetos") {
    const filters = parseAdminProjectFilters({ ...query, turma: id });
    const result = await listAdminProjects(actor.id, filters);
    if (result.filters.page !== filters.page) redirect(adminProjectHref(result.filters, id));
    projectContent = <AdminProjects result={result} scopedTurmaId={id}/>;
  }
  return <TurmaDetail {...details} projectContent={projectContent} owner={actor.role === "owner"}/>;
}
