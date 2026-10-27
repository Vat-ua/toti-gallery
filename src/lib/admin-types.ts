import type { StudentListParams } from "./student-list-params";

export type AdminTurma = {
  id: string; name: string; number: number; courseName: string | null; startYear: number | null; archived: boolean;
  students: number; projects: number;
};
export type StudentLookup = {
  id: string; name: string; email: string; status: "pending" | "active" | "suspended";
  member: boolean; blocked: boolean; reason: string | null;
};
export type StudentAdded = {
  id: string; name: string; email: string; status: "pending" | "active" | "suspended";
  created: boolean;
};
export type AdminStudent = {
  id: string; name: string; email: string; avatar: string | null;
  status: "pending" | "active" | "suspended"; role: "user" | "admin" | "owner";
  isDemo: boolean; turmaNames: string[]; turmaIds: string[];
};
export type StudentAccessLink = {
  id: string; purpose: "activation" | "password_reset";
  state: "valid" | "expired" | "used" | "revoked"; expiresAt: string;
};
export type ManagedStudent = AdminStudent & { emailVerified: boolean; accessLink: StudentAccessLink | null };
export type StudentListPage = { students: ManagedStudent[]; total: number; filters: StudentListParams };
export type StudentInvitation = {
  id: string; name: string; email: string; url: string; expiresAt: string;
};
export type TurmaProject = {
  id: string; slug: string; title: string; author: string; isFinal: boolean;
  visibility: "published" | "hidden";
};
export type ImportRow = { line: number; name: string; email: string; error?: string };
export type ImportPreview = ImportRow & {
  kind: "new" | "existing" | "member" | "error";
};
