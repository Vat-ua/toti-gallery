import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getProjects } from "@/lib/queries";
import { MyProjects } from "@/components/my-projects";

export const metadata: Metadata = { title: "Meus projetos" };
export default async function MyProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fmeus-projetos");
  const projects = (await getProjects({ participantId: user.id })).filter(project => project.authors.some(author => author.id === user.id));
  return <MyProjects user={user} projects={projects}/>;
}
