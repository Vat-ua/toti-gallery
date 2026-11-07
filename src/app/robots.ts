import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return {
    // Leave HTML pages crawlable so search engines can read their noindex metadata.
    // Authentication and permissions, not crawler rules, protect private data.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: new URL("/sitemap.xml", origin).href,
  };
}
