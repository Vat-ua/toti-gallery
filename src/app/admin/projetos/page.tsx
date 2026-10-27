import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { listTurmas } from "@/lib/admin-turmas";
import { listAdminProjects } from "@/lib/admin-projects";
import { adminProjectHref, parseAdminProjectFilters } from "@/lib/admin-project-params";
import { AdminProjects } from "@/components/admin-projects";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/entrar?next=%2Fadmin%2Fprojetos");
  if (!isStaff(actor.role)) notFound();
  const filters = parseAdminProjectFilters(await searchParams);
  const [result, turmas] = await Promise.all([listAdminProjects(actor.id, filters), listTurmas(actor.id)]);
  if (result.filters.page !== filters.page) redirect(adminProjectHref(result.filters));
  turmas.sort((a, b) => Number(a.archived) - Number(b.archived) || b.number - a.number);
  return <AdminProjects result={result} turmas={turmas}/>;
}
