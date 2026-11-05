import type { CoverFraming } from "./cover-framing";
import { requestJson } from "./http-client";

/** Editor values before server normalization; never a hydrated public Project. */
export type ProjectFormValues = {
  title: string;
  description: string;
  technologies: string[];
  isFinal: boolean;
  turmaId: string;
  coauthorIds: string[];
  coverStyle: string;
  imageUrl: string;
  coverFraming: CoverFraming | null;
  githubUrl: string;
  liveUrl: string;
};
export type CreatedProject = { id: string; slug: string };
export type ChangedProject = { ok: true; slug: string };

function projectForm(values: ProjectFormValues, image?: File | null) {
  const form = new FormData();
  form.set("data", JSON.stringify(values));
  if (image) form.set("image", image);
  return form;
}

export async function createProject(values: ProjectFormValues, image?: File | null): Promise<CreatedProject> {
  const fallback = "Não foi possível salvar seu projeto.";
  const data = await requestJson("/api/projects", { method: "POST", body: projectForm(values, image) }, fallback);
  if (typeof data.id !== "string" || !data.id || typeof data.slug !== "string" || !data.slug) throw new Error(fallback);
  return { id: data.id, slug: data.slug };
}

export async function updateProject(id: string, values: ProjectFormValues, image?: File | null): Promise<ChangedProject> {
  const fallback = "Não foi possível salvar seu projeto.";
  const data = await requestJson(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: projectForm(values, image) }, fallback);
  if (data.ok !== true || typeof data.slug !== "string" || !data.slug) throw new Error(fallback);
  return { ok: true, slug: data.slug };
}

export async function deleteProject(id: string): Promise<ChangedProject> {
  const fallback = "Não foi possível excluir o projeto.";
  const data = await requestJson(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" }, fallback);
  if (data.ok !== true || typeof data.slug !== "string" || !data.slug) throw new Error(fallback);
  return { ok: true, slug: data.slug };
}

export async function leaveProject(id: string): Promise<{ ok: true }> {
  const fallback = "Não foi possível sair do projeto.";
  const data = await requestJson(`/api/projects/${encodeURIComponent(id)}/authors/me`, { method: "DELETE" }, fallback);
  if (data.ok !== true) throw new Error(fallback);
  return { ok: true };
}
