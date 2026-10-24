import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProjectEditor } from "@/components/project-editor";

export const metadata: Metadata = { title: "Compartilhe sua próxima ideia" };
export default async function NewProjectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fmeus-projetos%2Fnovo");
  return <ProjectEditor user={user}/>;
}
