import type { Metadata } from "next";
import { Community } from "@/components/community";
import { getCommunityFilterOptions, readInitialCommunity } from "@/lib/queries";
import { sharingMetadata } from "@/lib/metadata";
import { readGalleryFilters } from "@/lib/gallery-filters";
import { searchParams as toSearchParams } from "@/lib/collection-page";

export const metadata: Metadata = sharingMetadata({ title: "Comunidade", description: "Conheça as pessoas da comunidade e explore seus projetos.", path: "/comunidade" });
export default async function CommunityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = readGalleryFilters(toSearchParams(await searchParams), "community");
  const [initialPage, filterOptions] = await Promise.all([readInitialCommunity(filters), getCommunityFilterOptions()]);
  return <Community initialPage={initialPage} filterOptions={filterOptions}/>;
}
