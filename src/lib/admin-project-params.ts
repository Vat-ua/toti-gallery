export type AdminProjectFilters = { query: string; turmaId: string; visibility: "all" | "published" | "hidden"; page: number };
export const ADMIN_PROJECT_PAGE_SIZE = 9;
export function parseAdminProjectFilters(params: Record<string, unknown>): AdminProjectFilters {
  const page = typeof params.page === "number" ? params.page : typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  return {
    query: typeof params.q === "string" ? params.q.replace(/\0/g, "").trim().slice(0, 254) : "",
    turmaId: typeof params.turma === "string" && params.turma.length <= 100 && params.turma ? params.turma : "all",
    visibility: params.visibility === "published" || params.visibility === "hidden" ? params.visibility : "all",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}
export function adminProjectHref(filters: AdminProjectFilters, scopedTurmaId?: string) {
  const params = new URLSearchParams();
  if (scopedTurmaId) params.set("tab", "projetos");
  if (filters.query) params.set("q", filters.query);
  if (!scopedTurmaId && filters.turmaId !== "all") params.set("turma", filters.turmaId);
  if (filters.visibility !== "all") params.set("visibility", filters.visibility);
  if (filters.page > 1) params.set("page", String(filters.page));
  return (scopedTurmaId ? `/admin/turmas/${encodeURIComponent(scopedTurmaId)}` : "/admin/projetos") + (params.size ? `?${params}` : "");
}
export function adminProjectReturn(value: unknown) {
  if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value)) return "/admin/projetos";
  let url: URL;
  try { url = new URL(value, "https://local.invalid"); } catch { return "/admin/projetos"; }
  return url.origin === "https://local.invalid" && (url.pathname === "/admin/projetos" || /^\/admin\/turmas\/[\w-]+$/.test(url.pathname)) ? url.pathname + url.search : "/admin/projetos";
}
