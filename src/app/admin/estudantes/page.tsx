import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { listStudents } from "@/lib/admin-students";
import { listTurmas } from "@/lib/admin-turmas";
import { StudentsList } from "@/components/admin-students";
import { parseStudentListParams, studentListHref } from "@/lib/student-list-params";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/entrar?next=%2Fadmin%2Festudantes");
  if (!isStaff(actor.role)) notFound();
  const filters = parseStudentListParams(await searchParams);
  const [result, turmas] = await Promise.all([listStudents(actor.id, filters), listTurmas(actor.id)]);
  if (result.filters.page !== filters.page) redirect(studentListHref(result.filters));
  turmas.sort((a, b) => Number(a.archived) - Number(b.archived) || b.number - a.number);
  return <StudentsList result={result} turmas={turmas} owner={actor.role === "owner"}/>;
}
