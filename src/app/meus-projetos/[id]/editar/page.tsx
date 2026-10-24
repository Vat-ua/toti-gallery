import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjects } from "@/lib/queries";
import { ProjectEditor } from "@/components/project-editor";

export const metadata: Metadata = { title: "Atualize sua ideia" };
export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/meus-projetos/${id}/editar`)}`);
  const project = (await getProjects()).find(project => project.id === id && project.author.id === user.id);
  if (!project) notFound();
  return <ProjectEditor user={user} project={project}/>;
}
