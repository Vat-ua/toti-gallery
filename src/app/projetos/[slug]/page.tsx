import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getProjectBySlug, getRelatedProjects } from "@/lib/queries";
import { getCurrentSession, isCurrentUser } from "@/lib/auth";
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
  const [project] = await Promise.all([getProjectBySlug(slug), getCurrentSession()]);
  if (!project) notFound();
  const related = getRelatedProjects(project);
  // The boundary still observes this rejection. Avoid an orphaned rejection if
  // the independent ownership check fails before the page can return it.
  void related.catch(() => {});
  return <ProjectDetails project={project} canEdit={await isCurrentUser(project.author.id)}
    relatedContent={<Suspense fallback={null}><RelatedContent projects={related}/></Suspense>}/>;
}

async function RelatedContent({ projects }: { projects: ReturnType<typeof getRelatedProjects> }) {
  return <RelatedProjects projects={await projects}/>;
}
