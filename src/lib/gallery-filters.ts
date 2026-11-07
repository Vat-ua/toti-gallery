import { requestedPage } from "./collection-page";

export type GalleryFilters = {
  query: string;
  cohort: string;
  techs: string[];
  sort: "recent" | "likes" | "az";
  finalOnly: boolean;
  page: number;
};

export type GalleryFilterOptions = {
  cohorts: string[];
  technologies: string[];
};

type SearchParams = Pick<URLSearchParams, "get" | "getAll">;

export type CollectionFilterMode = "gallery" | "community" | "page";

export function readGalleryFilters(params: SearchParams, mode: CollectionFilterMode = "gallery"): GalleryFilters {
  const cohort = params.get("cohort");
  const sort = params.get("sort");
  const rawPage = params.get("page") || "";
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    query: mode === "page" ? "" : (params.get("q") || "").replace(/\0/g, "").slice(0, 254),
    cohort: mode !== "page" && /^\d{1,10}$/.test(cohort || "") && Number(cohort) > 0 ? `Turma ${Number(cohort)}` : "",
    techs: mode === "gallery" ? [...new Set(params.getAll("tech").map(tech => tech.trim()))].filter(tech => !!tech && tech.length <= 80 && !tech.includes("\0")).slice(0, 24) : [],
    sort: mode === "gallery" && (sort === "likes" || sort === "az") ? sort : "recent",
    finalOnly: mode === "gallery" && params.get("final") === "1",
    page: requestedPage(page),
  };
}

export function galleryFilterParams(filters: GalleryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.cohort) params.set("cohort", filters.cohort.replace(/^Turma\s*/i, ""));
  filters.techs.forEach((tech) => params.append("tech", tech));
  if (filters.finalOnly) params.set("final", "1");
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}
