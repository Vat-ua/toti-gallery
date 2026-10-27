export type StudentListParams = {
  query: string;
  turmaId: string;
  status: "all" | "pending" | "active" | "suspended" | "demo";
  page: number;
  pageSize: 25 | 50;
};

export function parseStudentListParams(params: Record<string, unknown>): StudentListParams {
  const page = typeof params.page === "number" ? params.page : typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  const status = params.status;
  return {
    query: typeof params.q === "string" ? params.q.trim().slice(0, 254) : "",
    turmaId: typeof params.turma === "string" && params.turma.length > 0 && params.turma.length <= 100 ? params.turma : "all",
    status: status === "pending" || status === "active" || status === "suspended" || status === "demo" ? status : "all",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: params.pageSize === 50 || params.pageSize === "50" ? 50 : 25,
  };
}

export function studentListHref(params: StudentListParams) {
  const query = new URLSearchParams();
  if (params.query) query.set("q", params.query);
  if (params.turmaId !== "all") query.set("turma", params.turmaId);
  if (params.status !== "all") query.set("status", params.status);
  if (params.pageSize === 50) query.set("pageSize", "50");
  if (params.page > 1) query.set("page", String(params.page));
  return "/admin/estudantes" + (query.size ? `?${query}` : "");
}
