import { Gallery } from "@/components/gallery";
import { getProjects } from "@/lib/queries";
import { sharingMetadata } from "@/lib/metadata";

export const metadata = sharingMetadata();
export const dynamic = "force-dynamic";
export default async function HomePage() {
  const projects = await getProjects();
  return <Gallery projects={projects}/>;
}
