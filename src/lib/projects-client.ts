import type { CoverFraming } from "./cover-framing";
import { responseError } from "./form-validation";

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

async function request(path: string, method: string, fallback: string, body?: FormData): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetch(path, { method, ...(body ? { body } : {}) }); }
  catch { throw new Error("Confira sua conexão e tente novamente."); }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw responseError(data, fallback);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(fallback);
  return data as Record<string, unknown>;
}

export async function createProject(values: ProjectFormValues, image?: File | null): Promise<CreatedProject> {
  const fallback = "Não foi possível salvar seu projeto.";
  const data = await request("/api/projects", "POST", fallback, projectForm(values, image));
  if (typeof data.id !== "string" || !data.id || typeof data.slug !== "string" || !data.slug) throw new Error(fallback);
  return { id: data.id, slug: data.slug };
}

export async function updateProject(id: string, values: ProjectFormValues, image?: File | null): Promise<ChangedProject> {
  const fallback = "Não foi possível salvar seu projeto.";
  const data = await request(`/api/projects/${encodeURIComponent(id)}`, "PATCH", fallback, projectForm(values, image));
  if (data.ok !== true || typeof data.slug !== "string" || !data.slug) throw new Error(fallback);
  return { ok: true, slug: data.slug };
}

export async function deleteProject(id: string): Promise<ChangedProject> {
  const fallback = "Não foi possível excluir o projeto.";
  const data = await request(`/api/projects/${encodeURIComponent(id)}`, "DELETE", fallback);
  if (data.ok !== true || typeof data.slug !== "string" || !data.slug) throw new Error(fallback);
  return { ok: true, slug: data.slug };
}

export async function leaveProject(id: string): Promise<{ ok: true }> {
  const fallback = "Não foi possível sair do projeto.";
  const data = await request(`/api/projects/${encodeURIComponent(id)}/authors/me`, "DELETE", fallback);
  if (data.ok !== true) throw new Error(fallback);
  return { ok: true };
}
