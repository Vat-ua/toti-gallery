export type GalleryFilters = {
  query: string;
  cohort: string;
  techs: string[];
  sort: "recent" | "likes" | "az";
  featured: boolean;
  finalOnly: boolean;
};

export type GalleryFilterOptions = {
  cohorts: string[];
  technologies: string[];
};

type SearchParams = Pick<URLSearchParams, "get" | "getAll">;

export function readGalleryFilters(params: SearchParams, options: GalleryFilterOptions): GalleryFilters {
  const cohort = params.get("cohort");
  const sort = params.get("sort");
  return {
    query: params.get("q") || "",
    cohort: options.cohorts.find((value) => value.replace(/^Turma\s*/i, "") === cohort) || "",
    techs: [...new Set(params.getAll("tech"))].filter((tech) => options.technologies.includes(tech)),
    sort: sort === "likes" || sort === "az" ? sort : "recent",
    featured: params.get("featured") === "1",
    finalOnly: params.get("final") === "1",
  };
}

export function galleryFilterParams(filters: GalleryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.cohort) params.set("cohort", filters.cohort.replace(/^Turma\s*/i, ""));
  filters.techs.forEach((tech) => params.append("tech", tech));
  if (filters.finalOnly) params.set("final", "1");
  if (filters.featured) params.set("featured", "1");
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  return params;
}
