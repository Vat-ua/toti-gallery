import { readCommunityPage } from "@/lib/queries";
import { readGalleryFilters } from "@/lib/gallery-filters";
import { projectErrorResponse } from "@/lib/project-http";

export async function GET(request: Request) {
  try {
    return Response.json(await readCommunityPage(readGalleryFilters(new URL(request.url).searchParams, "community")), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return projectErrorResponse(error, "Não foi possível carregar as pessoas.", "community.list"); }
}
