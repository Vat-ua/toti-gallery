import type { MetadataRoute } from "next";
import { getSitemapRecords } from "@/lib/queries";

// Publications, activation and moderation take effect on the next request.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const records = await getSitemapRecords();
  return [
    ...["/", "/comunidade", "/sobre"].map(path => ({ url: new URL(path, origin).href })),
    ...records.projects.map(project => ({
      url: new URL(`/projetos/${encodeURIComponent(project.slug)}`, origin).href,
      lastModified: project.updatedAt,
    })),
    ...records.people.map(person => ({
      url: new URL(`/pessoas/${encodeURIComponent(person.slug)}`, origin).href,
    })),
  ];
}
