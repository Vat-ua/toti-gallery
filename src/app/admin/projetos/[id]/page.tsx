import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { getAdminProject } from "@/lib/admin-projects";
import { adminProjectReturn } from "@/lib/admin-project-params";
import { ProjectDetails } from "@/components/project-details";
import { ProjectModeration } from "@/components/admin-projects";

export const metadata: Metadata = { title: "Revisar projeto", robots: { index: false, follow: false } };
export default async function AdminProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const actor = await getCurrentUser();
  if (!actor) redirect(`/entrar?next=${encodeURIComponent(`/admin/projetos/${id}`)}`);
  if (!isStaff(actor.role)) notFound();
  const project = await getAdminProject(actor.id, id);
  if (!project) notFound();
  const backHref = adminProjectReturn((await searchParams).returnTo);
  return <ProjectDetails project={project} embedded readOnly canEdit={project.author.id === actor.id} backHref={backHref} notice={<div className="admin-moderation-summary">
    <div><span className={`admin-badge ${project.visibility === "hidden" ? "is-error" : ""}`}>{project.visibility === "hidden" ? "Oculto" : "Publicado"}</span>
      {project.visibility === "hidden" && <p className="admin-moderation-reason">{project.moderationReason}</p>}
      {project.moderatedAt && <p className="admin-help">{project.visibility === "hidden" ? "Ocultado" : "Restaurado"} por {project.moderatedByName || "administração"} em {new Date(project.moderatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} (Brasília).</p>}
    </div><ProjectModeration project={project}/>
  </div>}/>;
}
