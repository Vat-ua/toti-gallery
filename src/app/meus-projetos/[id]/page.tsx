import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { readProject } from "@/lib/queries";
import { ProjectDetails } from "@/components/project-details";

export const metadata: Metadata = { title: "Meu projeto", robots: { index: false, follow: false } };
export default async function PrivateProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/meus-projetos/${id}`)}`);
  const project = await readProject({ id, participantId: user.id });
  if (!project) notFound();
  if (project.visibility === "published") redirect(`/projetos/${project.slug}`);
  return <ProjectDetails project={project} canEdit={project.author.id === user.id} readOnly backHref="/meus-projetos" backLabel="Meus projetos" notice={<div className="admin-notice project-moderation-note"><strong>Oculto pela administração</strong><p>Este projeto está disponível apenas para seus autores e para a administração.</p>{project.moderationReason && <p><strong>Motivo: </strong>{project.moderationReason}</p>}</div>}/>;
}
