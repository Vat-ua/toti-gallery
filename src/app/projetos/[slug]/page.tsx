import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getProjectBySlug, getRelatedProjects } from "@/lib/queries";
import { getPublicOwnership } from "@/lib/public-identity";
import { ProjectDetails, RelatedProjects } from "@/components/project-details";
import { sharingMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  return sharingMetadata({ title: project?.title || "Projeto não encontrado", description: project?.description, path: `/projetos/${encodeURIComponent(slug)}` });
}
export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const related = getRelatedProjects(project);
  return <ProjectDetails project={project} canEdit={getPublicOwnership(project.author.id)}
    relatedContent={<Suspense fallback={null}><RelatedContent projects={related}/></Suspense>}/>;
}

async function RelatedContent({ projects }: { projects: ReturnType<typeof getRelatedProjects> }) {
  return <RelatedProjects projects={await projects}/>;
}
