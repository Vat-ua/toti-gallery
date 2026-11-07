import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPersonBySlug, readInitialProjects, getProfileProjectStats } from "@/lib/queries";
import { getCurrentSession, isCurrentUser } from "@/lib/auth";
import { ProfileSummary } from "@/components/profile-summary";
import { Icon } from "@/components/icon";
import { BrandSymbol } from "@/components/brand-symbol";
import { ProfileProjects } from "@/components/profile-projects";
import { readGalleryFilters } from "@/lib/gallery-filters";
import { searchParams as toSearchParams } from "@/lib/collection-page";
import { sharingMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);
  return sharingMetadata({ title: person?.name || "Perfil não encontrado", description: person?.bio, path: `/pessoas/${encodeURIComponent(slug)}` });
}
export default async function ProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [person, query] = await Promise.all([getPersonBySlug(slug), searchParams, getCurrentSession()]);
  if (!person) notFound();
  const [initialPage, stats, isOwner] = await Promise.all([
    readInitialProjects(readGalleryFilters(toSearchParams(query), "page"), { kind: "profile", userId: person.id }),
    getProfileProjectStats(person.id),
    isCurrentUser(person.id),
  ]);
  return <main id="conteudo" className="container inner-page"><Link href="/comunidade" className="back-link"><Icon name="arrow-left" size={16}/>Comunidade</Link><div className="profile-banner" aria-hidden="true"><span><BrandSymbol/></span><i/></div><ProfileSummary person={person} isOwner={isOwner} projectCount={stats.total} totalLikes={stats.totalLikes}/><ProfileProjects initialPage={initialPage} slug={slug} isOwner={isOwner}/></main>;
}
