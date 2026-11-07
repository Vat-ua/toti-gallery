import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCoauthorCandidates, readProject } from "@/lib/queries";
import { ProjectEditor } from "@/components/project-editor";

export const metadata: Metadata = { title: "Editar projeto", robots: { index: false, follow: false } };
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/meus-projetos/${id}/editar`)}`);
  const project = await readProject({ id, participantId: user.id, ownerOnly: true });
  if (!project) notFound();
  const people = await getCoauthorCandidates(project.turmaId);
  return <ProjectEditor key={project.id} user={user} project={project} people={people}/>;
}
