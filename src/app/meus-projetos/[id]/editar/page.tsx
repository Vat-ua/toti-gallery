import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCoauthorCandidates, getProjects } from "@/lib/queries";
import { ProjectEditor } from "@/components/project-editor";

export const metadata: Metadata = { title: "Editar projeto" };
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/meus-projetos/${id}/editar`)}`);
  const projects = await getProjects({ participantId: user.id });
  const project = projects.find(project => project.id === id && project.author.id === user.id);
  if (!project) notFound();
  const people = await getCoauthorCandidates(project.turmaId);
  return <ProjectEditor user={user} project={project} people={people}/>;
}
