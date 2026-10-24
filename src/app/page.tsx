import { Gallery } from "@/components/gallery";
import { getProjects, getPeople } from "@/lib/queries";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const [projects, people] = await Promise.all([getProjects(), getPeople()]);
  return <Gallery projects={projects} people={people}/>;
}
