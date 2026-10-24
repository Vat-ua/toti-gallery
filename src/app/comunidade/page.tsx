import type { Metadata } from "next";
import { Community } from "@/components/community";
import { getPeople, getProjects } from "@/lib/queries";

export const metadata: Metadata = { title: "Gente de todo lugar. Talento sem fronteiras." };
export default async function CommunityPage() {
  const [people, projects] = await Promise.all([getPeople(), getProjects()]);
  return <Community people={people} projects={projects}/>;
}
