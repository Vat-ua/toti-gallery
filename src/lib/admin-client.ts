import { requestJson } from "./http-client";
import type { AdminStudent, AdministratorCandidate, ImportPreview, StudentAdded, StudentLookup, StudentProfileSnapshot, TurmaSnapshot } from "./admin-types";

export type Grant = { url: string; expiresAt: string };
export type MembershipSnapshot = { turmaIds: string[]; primaryTurmaId: string | null };
export type StudentCandidate = Pick<AdminStudent, "id" | "name" | "email" | "status" | "isDemo">;
export type AddedAdministrator = { id: string; name: string; email: string; grant: Grant | null };
export type ImportResult = { preview: ImportPreview[]; created: number; linked: number; unchanged: number };
type Data = Record<string, unknown>;
const fallback = "Não foi possível concluir a operação. Tente novamente.";
function invalid(): never { throw new Error(fallback); }
function record(value: unknown): Data { return value && typeof value === "object" && !Array.isArray(value) ? value as Data : invalid(); }
function string(value: unknown) { return typeof value === "string" ? value : invalid(); }
function id(value: unknown) { const result = string(value); return result ? result : invalid(); }
function boolean(value: unknown) { return typeof value === "boolean" ? value : invalid(); }
function count(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : invalid(); }
function status(value: unknown): AdminStudent["status"] { return value === "pending" || value === "active" || value === "suspended" ? value : invalid(); }
function array<T>(value: unknown, decode: (value: unknown) => T): T[] { return Array.isArray(value) ? value.map(decode) : invalid(); }
function identity(value: unknown): AdministratorCandidate {
  const data = record(value);
  return { id: id(data.id), name: string(data.name), email: string(data.email), status: status(data.status) };
}
function grant(value: unknown): Grant {
  const data = record(value), url = string(data.url), expiresAt = string(data.expiresAt);
  try { if (!["https:", "http:"].includes(new URL(url).protocol) || !Number.isFinite(Date.parse(expiresAt))) invalid(); }
  catch { invalid(); }
  return { url, expiresAt };
}
function memberships(data: Data): MembershipSnapshot {
  const turmaIds = array(data.turmaIds, id), primaryTurmaId = data.primaryTurmaId === null ? null : id(data.primaryTurmaId);
  if (new Set(turmaIds).size !== turmaIds.length || (primaryTurmaId !== null && !turmaIds.includes(primaryTurmaId))) invalid();
  return { turmaIds, primaryTurmaId };
}
function addedAdministrator(data: Data): AddedAdministrator {
  return { id: id(data.id), name: string(data.name), email: string(data.email), grant: data.grant === null ? null : grant(data.grant) };
}
function imported(data: Data): ImportResult {
  return { created: count(data.created), linked: count(data.linked), unchanged: count(data.unchanged), preview: array(data.preview, value => {
    const row = record(value);
    const kind = row.kind;
    if ((kind !== "new" && kind !== "existing" && kind !== "member" && kind !== "error") || count(row.line) < 1) invalid();
    return { line: count(row.line), name: string(row.name), email: string(row.email), kind, ...(row.error === undefined ? {} : { error: string(row.error) }) };
  }) };
}
const identifier = (data: Data) => ({ id: id(data.id) });
const acknowledged = (data: Data) => data.ok === true ? { ok: true as const } : invalid();
async function call<T>(path: string, body: unknown, decode: (data: Data) => T, method = "POST", signal?: AbortSignal): Promise<T> {
  return decode(await requestJson(path, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), signal }, fallback));
}
const turmaPath = (id: string) => `/api/admin/turmas/${encodeURIComponent(id)}`;
const studentPath = (id: string) => `/api/admin/estudantes/${encodeURIComponent(id)}`;
const administratorPath = (id: string) => `/api/admin/administradores/${encodeURIComponent(id)}`;

export const turmasApi = {
  save(turmaId: string | undefined, values: { number: number; courseName: string; startYear: number }, expected?: TurmaSnapshot) {
    return call(turmaId ? turmaPath(turmaId) : "/api/admin/turmas", turmaId ? { action: "save", ...values, expected } : values, identifier, turmaId ? "PATCH" : "POST");
  },
  archive(turmaId: string, archived: boolean) { return call(turmaPath(turmaId), { action: "archive", archived }, acknowledged, "PATCH"); },
  lookup(turmaId: string, email: string, signal?: AbortSignal) {
    return call(`${turmaPath(turmaId)}/members`, { action: "lookup", email }, data => {
      if (data.student === null) return null;
      const person = record(data.student);
      return { ...identity(person), member: boolean(person.member), blocked: boolean(person.blocked), reason: person.reason === null ? null : string(person.reason) } satisfies StudentLookup;
    }, "POST", signal);
  },
  candidates(turmaId: string, query: string, signal?: AbortSignal) {
    return call(`${turmaPath(turmaId)}/members`, { action: "candidates", query }, data => array(data.candidates, value => ({ ...identity(value), isDemo: boolean(record(value).isDemo) })), "POST", signal);
  },
  add(turmaId: string, name: string, email: string) {
    return call(`${turmaPath(turmaId)}/members`, { action: "add", name, email }, data => ({ ...identity(data), created: boolean(data.created) } satisfies StudentAdded));
  },
  membership(turmaId: string, userId: string, add: boolean) { return call(`${turmaPath(turmaId)}/members`, { userId }, acknowledged, add ? "POST" : "DELETE"); },
  access(turmaId: string, userId: string, purpose: "activation" | "password_reset") { return call(`${turmaPath(turmaId)}/access`, { userId, purpose }, grant); },
  import(turmaId: string, text: string, action: "preview" | "confirm", excluded: number[] = []) { return call(`${turmaPath(turmaId)}/import`, { action, text, excluded }, imported); },
};
export const studentsApi = {
  profile(userId: string, name: string, email: string, expected: StudentProfileSnapshot) { return call(studentPath(userId), { action: "profile", name, email, expected }, data => ({ name: string(data.name), email: string(data.email), emailChanged: boolean(data.emailChanged) })); },
  memberships(userId: string, value: MembershipSnapshot, expected: MembershipSnapshot) { return call(studentPath(userId), { action: "turmas", ...value, expected }, memberships); },
  suspend(userId: string, suspended: boolean) { return call(studentPath(userId), { action: "suspend", suspended }, data => ({ status: status(data.status) })); },
  access(userId: string, purpose: "activation" | "password_reset") { return call(studentPath(userId), { action: "access", purpose }, grant); },
  revoke(userId: string, grantId: string) { return call(studentPath(userId), { action: "revoke-link", grantId }, acknowledged); },
  remove(userId: string) { return call(studentPath(userId), { action: "delete" }, identifier); },
};
export const administratorsApi = {
  candidates(query: string, signal?: AbortSignal) { return call(`/api/admin/administradores?q=${encodeURIComponent(query)}`, undefined, data => array(data.candidates, identity), "GET", signal); },
  create(name: string, email: string) { return call("/api/admin/administradores", { action: "create", name, email }, addedAdministrator); },
  promote(userId: string) { return call("/api/admin/administradores", { action: "promote", userId }, addedAdministrator); },
  access(userId: string, purpose: "activation" | "password_reset") { return call(administratorPath(userId), { action: "access", purpose }, grant); },
  revoke(userId: string, grantId: string) { return call(administratorPath(userId), { action: "revoke-link", grantId }, identifier); },
  remove(userId: string) { return call(administratorPath(userId), { action: "remove" }, identifier); },
};
export function moderateProject(projectId: string, visibility: "published" | "hidden", reason: string) {
  return call(`/api/admin/projetos/${encodeURIComponent(projectId)}`, { action: visibility === "hidden" ? "restore" : "hide", expectedVisibility: visibility, reason }, data => {
    if (data.visibility !== "published" && data.visibility !== "hidden") invalid();
    return { id: id(data.id), visibility: data.visibility };
  });
}
export const message = (error: unknown) => error instanceof TypeError ? "Confira sua conexão e tente novamente." : error instanceof Error ? error.message : "Confira sua conexão e tente novamente.";
export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const statusText = { pending: "Pendente", active: "Ativo", suspended: "Suspenso" };
