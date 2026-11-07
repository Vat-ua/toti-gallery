import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { readInitialProjects } from "@/lib/queries";
import { readGalleryFilters } from "@/lib/gallery-filters";
import { searchParams as toSearchParams } from "@/lib/collection-page";
import { MyProjects } from "@/components/my-projects";

export const metadata: Metadata = { title: "Meus projetos", robots: { index: false, follow: false } };
export default async function MyProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fmeus-projetos");
  const initialPage = await readInitialProjects(readGalleryFilters(toSearchParams(await searchParams), "page"), { kind: "mine", userId: user.id });
  return <MyProjects user={user} projects={initialPage.items} pagination={initialPage}/>;
}
