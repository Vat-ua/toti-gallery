import { requestedPage } from "./collection-page";

export type AdminProjectFilters = { query: string; turmaId: string; visibility: "all" | "published" | "hidden"; page: number };
export function parseAdminProjectFilters(params: Record<string, unknown>): AdminProjectFilters {
  const page = typeof params.page === "number" ? params.page : typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  return {
    query: typeof params.q === "string" ? params.q.replace(/\0/g, "").trim().slice(0, 254) : "",
    turmaId: typeof params.turma === "string" && params.turma.length <= 100 && params.turma ? params.turma : "all",
    visibility: params.visibility === "published" || params.visibility === "hidden" ? params.visibility : "all",
    page: requestedPage(page),
  };
}
export function adminProjectHref(filters: AdminProjectFilters, scopedTurmaId?: string) {
  const params = adminProjectParams(filters);
  if (scopedTurmaId) params.set("tab", "projetos");
  if (scopedTurmaId) params.delete("turma");
  return (scopedTurmaId ? `/admin/turmas/${encodeURIComponent(scopedTurmaId)}` : "/admin/projetos") + (params.size ? `?${params}` : "");
}
export function adminProjectParams(filters: AdminProjectFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.turmaId !== "all") params.set("turma", filters.turmaId);
  if (filters.visibility !== "all") params.set("visibility", filters.visibility);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}
export function readAdminProjectFilters(params: Pick<URLSearchParams, "get">, scopedTurmaId?: string) {
  return parseAdminProjectFilters({ q: params.get("q"), turma: scopedTurmaId || params.get("turma"), visibility: params.get("visibility"), page: params.get("page") });
}
export function adminProjectReturn(value: unknown) {
  if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value)) return "/admin/projetos";
  let url: URL;
  try { url = new URL(value, "https://local.invalid"); } catch { return "/admin/projetos"; }
  return url.origin === "https://local.invalid" && (url.pathname === "/admin/projetos" || /^\/admin\/turmas\/[\w-]+$/.test(url.pathname)) ? url.pathname + url.search : "/admin/projetos";
}
