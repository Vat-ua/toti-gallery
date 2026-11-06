import type { Project } from "./types";

type Location = Pick<Project, "id" | "slug"> & Partial<Pick<Project, "visibility">>;
/** Navigation for the student screens; data operations never navigate. */
export type ProjectLinks = {
  list: string;
  create: string;
  profile: (slug: string) => string;
  view: (project: Location) => string;
  edit: (id: string) => string;
  inspect: (id: string) => string;
};
export const studentProjectLinks: ProjectLinks = {
  list: "/meus-projetos", create: "/meus-projetos/novo",
  profile: slug => `/pessoas/${slug}`,
  view: project => project.visibility === "hidden" ? `/meus-projetos/${project.id}` : `/projetos/${project.slug}`,
  edit: id => `/meus-projetos/${id}/editar`,
  inspect: id => `/meus-projetos/${encodeURIComponent(id)}`,
};
