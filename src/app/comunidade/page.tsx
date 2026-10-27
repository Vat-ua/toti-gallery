import type { Metadata } from "next";
import { Community } from "@/components/community";
import { getCommunityPeople, getProjects } from "@/lib/queries";

export const metadata: Metadata = { title: "Comunidade", description: "Conheça as pessoas da comunidade e explore seus projetos." };
export default async function CommunityPage() {
  const [people, projects] = await Promise.all([getCommunityPeople(), getProjects()]);
  return <Community people={people} projects={projects}/>;
}
