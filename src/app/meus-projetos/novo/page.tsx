import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProjectEditor } from "@/components/project-editor";
import { getPublicationPeople, getPublicationTurmas } from "@/lib/queries";

export const metadata: Metadata = { title: "Publicar projeto", robots: { index: false, follow: false } };
export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fmeus-projetos%2Fnovo");
  const [turmas, people] = await Promise.all([getPublicationTurmas(user.id), getPublicationPeople(user.id)]);
  return <ProjectEditor user={user} people={people} turmas={turmas}/>;
}
