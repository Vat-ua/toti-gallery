import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProjects } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { ProjectDetails } from "@/components/project-details";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = (await getProjects()).find(p => p.slug === slug);
  return { title: project?.title || "Projeto não encontrado", description: project?.description.replace(/\s+/g, " ").trim().slice(0, 160) };
}
export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [projects, user] = await Promise.all([getProjects(), getCurrentUser()]);
  const project = projects.find(p => p.slug === slug);
  if (!project) notFound();
  const related = projects.filter(p => p.id !== project.id).sort((a, b) => Number(b.authors.some(author => project.authors.some(person => person.id === author.id))) - Number(a.authors.some(author => project.authors.some(person => person.id === author.id)))).slice(0, 3);
  return <ProjectDetails project={project} related={related} canEdit={user?.id === project.author.id}/>;
}
