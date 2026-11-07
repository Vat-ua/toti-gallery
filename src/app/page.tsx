import { Gallery } from "@/components/gallery";
import { getGalleryFilterOptions, readInitialProjects } from "@/lib/queries";
import { sharingMetadata } from "@/lib/metadata";
import { readGalleryFilters } from "@/lib/gallery-filters";
import { searchParams as toSearchParams } from "@/lib/collection-page";

export const metadata = sharingMetadata();
export const dynamic = "force-dynamic";
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = readGalleryFilters(toSearchParams(await searchParams));
  const [initialPage, filterOptions] = await Promise.all([readInitialProjects(filters), getGalleryFilterOptions()]);
  return <Gallery initialPage={initialPage} filterOptions={filterOptions}/>;
}
