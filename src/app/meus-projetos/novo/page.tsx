import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProjectEditor } from "@/components/project-editor";
import { getCoauthorCandidates } from "@/lib/queries";

export const metadata: Metadata = { title: "Publicar projeto" };
export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fmeus-projetos%2Fnovo");
  const people = user.turmaId ? await getCoauthorCandidates(user.turmaId) : [];
  return <ProjectEditor user={user} people={people}/>;
}
