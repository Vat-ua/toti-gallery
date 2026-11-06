import type { Metadata } from "next";
import { Community } from "@/components/community";
import { getCommunityPeople, getProjects } from "@/lib/queries";
import { sharingMetadata } from "@/lib/metadata";

export const metadata: Metadata = sharingMetadata({ title: "Comunidade", description: "Conheça as pessoas da comunidade e explore seus projetos.", path: "/comunidade" });
export default async function CommunityPage() {
  const [people, projects] = await Promise.all([getCommunityPeople(), getProjects()]);
  return <Community people={people} projects={projects}/>;
}
