import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProjectEditor } from "@/components/project-editor";
import { getCoauthorCandidates, getPublicationTurmas } from "@/lib/queries";

export const metadata: Metadata = { title: "Publicar projeto" };
export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fmeus-projetos%2Fnovo");
  const turmas = await getPublicationTurmas(user.id);
  const people = await getCoauthorCandidates(turmas.map(turma => turma.id));
  return <ProjectEditor user={user} people={people} turmas={turmas}/>;
}
