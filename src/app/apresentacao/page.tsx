import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Presentation } from "@/components/presentation";
import { sharingMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...sharingMetadata({ title: "Apresentação do projeto", description: "Conheça a experiência de publicação, a administração e as decisões técnicas da Toti Gallery.", path: "/apresentacao", canonical: false }),
  robots: { index: false, follow: false },
};

export default async function PresentationPage() {
  if (process.env.GALLERY_PRESENTATION_ENABLED === "false") notFound();
  return <Presentation authenticated={!!await getCurrentUser()}/>;
}
