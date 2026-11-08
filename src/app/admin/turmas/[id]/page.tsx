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
  const query = await searchParams;
  const projectTab = query.tab === "projetos";
  const filters = parseAdminProjectFilters({ ...query, turma: id });
  const [details, result] = await Promise.all([
    turmaDetails(actor.id, id, { includeMembers: !projectTab }).catch(error => {
      if (error instanceof AdminError && error.status === 404) notFound();
      throw error;
    }),
    projectTab ? listAdminProjects(actor.id, filters) : Promise.resolve(null),
  ]);
  if (result && result.filters.page !== filters.page) redirect(adminProjectHref(result.filters, id));
  const projectContent = result ? <AdminProjects result={result} scopedTurmaId={id}/> : null;
  return <TurmaDetail {...details} projectContent={projectContent} owner={actor.role === "owner"}/>;
}
